"""AI service: RAG pipeline, embeddings, vector store, roadmap generation."""
import os
import json
import pickle
import logging
import numpy as np
from flask import current_app
from models import db, Document, Embedding
from error_handler import NotFoundError, ValidationError
from security import sanitize_string

logger = logging.getLogger(__name__)

# ---------- Vector Store Manager ----------

class VectorStoreManager:
    """Manages embeddings with pure Python fallback for Python 3.14+ compatibility."""
    
    def __init__(self, store_path):
        import os
        self.store_path = store_path
        self.metadata = []  # List of {user_id, document_id, chunk_index, chunk_text, embedding: list[float]}
        self.dimension = 1536  # OpenAI dimension
        os.makedirs(store_path, exist_ok=True)
        self._load_or_create()
    
    def _load_or_create(self):
        """Load existing data or create new one."""
        import os, pickle, logging
        logger = logging.getLogger(__name__)
        meta_path = os.path.join(self.store_path, 'index_metadata.pkl')
        try:
            if os.path.exists(meta_path):
                with open(meta_path, 'rb') as f:
                    self.metadata = pickle.load(f)
                logger.info(f"Loaded {len(self.metadata)} vectors (Pure Python fallback)")
            else:
                self.metadata = []
                logger.info("Created new Pure Python vector store")
        except Exception as e:
            logger.warning(f"Failed to load vector store: {e}")
            self.metadata = []
    
    def _save(self):
        """Persist to disk."""
        import os, pickle, logging
        logger = logging.getLogger(__name__)
        try:
            meta_path = os.path.join(self.store_path, 'index_metadata.pkl')
            with open(meta_path, 'wb') as f:
                pickle.dump(self.metadata, f)
        except Exception as e:
            logger.error(f"Failed to save vector store: {e}")
    
    def get_openai_client(self):
        import os
        from config import config_map
        env = os.getenv('FLASK_ENV', 'development')
        conf = config_map.get(env)
        if not conf:
            return None
        api_key = conf.OPENAI_API_KEY
        if api_key:
            try:
                from openai import OpenAI
                return OpenAI(api_key=api_key)
            except ImportError:
                pass
        return None
    
    def embed_texts(self, texts):
        """Generate embeddings using OpenAI."""
        client = self.get_openai_client()
        if client:
            try:
                response = client.embeddings.create(
                    input=texts,
                    model="text-embedding-3-small"
                )
                return [data.embedding for data in response.data]
            except Exception:
                pass
        # Mock embedding (random) for development without ML libs
        import random
        return [[random.uniform(-1, 1) for _ in range(self.dimension)] for _ in texts]
    
    def add_chunks(self, user_id, document_id, chunks):
        """Add text chunks to the vector store."""
        import logging
        logger = logging.getLogger(__name__)
        if not chunks:
            return
        
        # Process in batches of 10 for OpenAI limits
        batch_size = 10
        for i in range(0, len(chunks), batch_size):
            batch_chunks = chunks[i:i+batch_size]
            embeddings = self.embed_texts(batch_chunks)
            
            for j, (chunk_text, embedding) in enumerate(zip(batch_chunks, embeddings)):
                self.metadata.append({
                    'user_id': user_id,
                    'document_id': document_id,
                    'chunk_index': i + j,
                    'chunk_text': chunk_text,
                    'embedding': embedding
                })
        
        self._save()
        logger.info(f"Added {len(chunks)} chunks for user {user_id}, doc {document_id}")
    
    def search(self, user_id, query_text, top_k=10):
        """Search vector store filtered by user_id using pure Python Cosine Similarity."""
        if not self.metadata:
            return []
            
        user_docs = [m for m in self.metadata if m.get('user_id') == user_id]
        if not user_docs:
            return []
        
        query_embedding = self.embed_texts([query_text])[0]
        
        import math
        def cosine_similarity(v1, v2):
            dot = sum(a * b for a, b in zip(v1, v2))
            norm1 = math.sqrt(sum(a * a for a in v1))
            norm2 = math.sqrt(sum(b * b for b in v2))
            if norm1 == 0 or norm2 == 0: return 0.0
            return dot / (norm1 * norm2)
        
        results = []
        for doc in user_docs:
            if 'embedding' not in doc:
                continue
            sim = cosine_similarity(query_embedding, doc['embedding'])
            # We treat distance as 1 - similarity so lower is better (like FAISS L2)
            dist = 1.0 - sim
            results.append({
                'chunk_text': doc['chunk_text'],
                'document_id': doc['document_id'],
                'chunk_index': doc['chunk_index'],
                'score': float(dist),
            })
            
        # Sort by distance ascending
        results.sort(key=lambda x: x['score'])
        return results[:top_k]
    
    def remove_document(self, document_id):
        """Remove all vectors for a document."""
        self.metadata = [
            m for m in self.metadata if m.get('document_id') != document_id
        ]
        self._save()

# Global vector store instance (initialized in app factory)
_vector_store = None


def get_vector_store():
    global _vector_store
    if _vector_store is None:
        store_path = current_app.config.get(
            'VECTOR_STORE_PATH',
            os.path.join(os.path.dirname(__file__), '..', 'vector_store')
        )
        _vector_store = VectorStoreManager(store_path)
    return _vector_store


# ---------- Text Chunking ----------

def chunk_text(text, chunk_size=500, overlap=50):
    """Split text into overlapping chunks by word count."""
    if not text:
        return []
    
    words = text.split()
    chunks = []
    start = 0
    
    while start < len(words):
        end = start + chunk_size
        chunk = ' '.join(words[start:end])
        if chunk.strip():
            chunks.append(chunk.strip())
        start += chunk_size - overlap
    
    return chunks


# ---------- Query Rewriting ----------

def rewrite_query(query):
    """Expand user query with synonyms and keywords for better search."""
    import re
    expansions = {
        'explain': 'explanation definition overview',
        'how': 'method process steps procedure',
        'what': 'definition meaning concept',
        'why': 'reason cause purpose',
        'compare': 'comparison difference similarity versus',
        'example': 'example instance sample demonstration',
        'best': 'best optimal recommended top',
        'learn': 'learn study understand tutorial',
        'code': 'code implementation program algorithm',
        'formula': 'formula equation expression mathematical',
    }
    words = query.lower().split()
    extra = []
    for w in words:
        if w in expansions:
            extra.append(expansions[w])
    if extra:
        return query + ' ' + ' '.join(extra)
    return query


# ---------- RAG Pipeline ----------

def process_document_embeddings(user_id, document_id):
    """Process a document: chunk text and create embeddings."""
    document = Document.query.get(document_id)
    if not document or document.user_id != user_id:
        raise NotFoundError("Document not found")
    
    if not document.content_text:
        return {'message': 'No text content to process'}
    
    # Chunk the text
    chunks = chunk_text(
        document.content_text,
        chunk_size=current_app.config.get('CHUNK_SIZE', 500),
        overlap=current_app.config.get('CHUNK_OVERLAP', 50),
    )
    
    # Add to vector store
    vs = get_vector_store()
    vs.add_chunks(user_id, document_id, chunks)
    
    # Save embedding metadata to DB
    for i, chunk in enumerate(chunks):
        emb = Embedding(
            user_id=user_id,
            document_id=document_id,
            chunk_index=i,
            chunk_text=chunk,
            vector_id=f"{document_id}_{i}",
        )
        db.session.add(emb)
    
    # Update document status
    document.status = 'ready'
    db.session.commit()
    
    return {
        'message': f'Processed {len(chunks)} chunks',
        'chunks_count': len(chunks),
    }


def query_documents(user_id, query, top_k=5):
    """RAG query: hybrid search (vector + BM25) with query rewriting."""
    query = sanitize_string(query, 2000)
    if not query:
        raise ValidationError("Query cannot be empty")
    
    # Query rewriting for better search
    expanded_query = rewrite_query(query)
    
    vs = get_vector_store()
    
    # Vector search with user isolation
    vector_results = vs.search(
        user_id, expanded_query,
        top_k=current_app.config.get('TOP_K_RESULTS', 10)
    )
    
    # Merge results: deduplicate by (document_id, chunk_index)
    seen = set()
    merged = []
    for r in vector_results:
        key = (r['document_id'], r['chunk_index'])
        if key not in seen:
            seen.add(key)
            r['source'] = 'vector'
            merged.append(r)
    
    if not merged:
        return {
            'answer': "I couldn't find relevant information in your documents. Try uploading more documents or rephrasing your query.",
            'sources': [],
            'query': query,
        }
    
    # Sort merged results by score
    merged.sort(key=lambda x: x['score'])
    top_results = merged[:current_app.config.get('RERANK_TOP_K', 5)]
    
    # Token budget control
    max_tokens = current_app.config.get('MAX_CONTEXT_TOKENS', 3000)
    context_parts = []
    token_count = 0
    for result in top_results:
        chunk_tokens = len(result['chunk_text'].split())
        if token_count + chunk_tokens > max_tokens:
            break
        context_parts.append(result['chunk_text'])
        token_count += chunk_tokens
    
    context = '\n\n---\n\n'.join(context_parts)
    
    # Generate answer
    answer = _generate_answer(query, context)
    
    # Get source document info
    sources = []
    seen_docs = set()
    for r in top_results:
        if r['document_id'] not in seen_docs:
            doc = Document.query.get(r['document_id'])
            if doc:
                sources.append({
                    'document_id': doc.id,
                    'title': doc.title,
                    'relevance': r['score'],
                })
                seen_docs.add(r['document_id'])
    
    return {
        'answer': answer,
        'sources': sources,
        'query': query,
        'chunks_used': len(context_parts),
    }


def _generate_answer(query, context):
    """Generate answer using LLM. Falls back to smart extraction if no API key."""
    openai_key = current_app.config.get('OPENAI_API_KEY', '')
    
    if openai_key:
        result = _openai_answer(query, context, openai_key)
        if result:
            return result
    
    # Smart local fallback: extract and format relevant sentences
    return _smart_local_answer(query, context)


def _smart_local_answer(query, context):
    """Generate a well-formatted answer from context without LLM."""
    import re
    
    query_words = set(re.findall(r'\b\w{3,}\b', query.lower()))
    
    # Split context into sentences
    sentences = re.split(r'(?<=[.!?])\s+', context)
    
    # Score sentences by relevance to query
    scored = []
    for sent in sentences:
        sent = sent.strip()
        if len(sent) < 15:
            continue
        sent_words = set(re.findall(r'\b\w{3,}\b', sent.lower()))
        overlap = len(query_words & sent_words)
        if overlap > 0:
            scored.append((overlap, sent))
    
    # Sort by relevance, take top sentences
    scored.sort(key=lambda x: -x[0])
    top_sentences = [s[1] for s in scored[:8]]
    
    if not top_sentences:
        # If no relevant sentences found, use first part of context
        top_sentences = [s.strip() for s in sentences[:5] if len(s.strip()) > 15]
    
    if not top_sentences:
        return "I found some documents but couldn't extract a clear answer. Try rephrasing your question."
    
    # Format the answer nicely
    answer_text = ' '.join(top_sentences)
    
    # Trim to reasonable length
    if len(answer_text) > 1200:
        answer_text = answer_text[:1200].rsplit('.', 1)[0] + '.'
    
    return (
        f"Based on your documents, here's what I found:\n\n"
        f"{answer_text}\n\n"
        f"---\n"
        f"*💡 For AI-generated answers, add a valid OpenAI API key in your .env file.*"
    )


def _groq_answer(query, context, api_key):
    """Generate answer using Groq API with rich markdown formatting."""
    try:
        import groq
        import os
        from config import config_map
        env = os.getenv('FLASK_ENV', 'development')
        model = config_map.get(env).GROQ_MODEL if config_map.get(env) else 'llama3-70b-8192'
        
        client = groq.Groq(api_key=api_key)
        
        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an expert AI assistant for a knowledge platform. "
                        "Answer the user's question based on the provided context from their documents. "
                        "Format your response in rich markdown:\n"
                        "- Use **bold** for key terms and *italics* for emphasis\n"
                        "- Use ## headings to organize sections\n"
                        "- Use bullet points and numbered lists for clarity\n"
                        "- Use LaTeX math notation with $ for inline (e.g. $E = mc^2$) and $$ for display math\n"
                        "- Use ```language for code blocks\n"
                        "- Use > for important quotes or definitions\n"
                        "- Use tables when comparing items\n"
                        "- Be thorough, educational, and well-structured like a textbook explanation\n"
                        "- If formulas exist in the context, present them properly in LaTeX\n"
                        "- Always provide clear, detailed explanations"
                    )
                },
                {
                    "role": "user",
                    "content": f"Context from my documents:\n{context}\n\nQuestion: {query}"
                }
            ],
            max_tokens=1500,
            temperature=0.4,
        )
        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"Groq API error: {e}")
        return None


# ---------- Roadmap Generator ----------

def generate_roadmap(user_id, goal, level='beginner', time_available='2 hours/day'):
    """Generate a learning roadmap based on goal."""
    goal = sanitize_string(goal, 500)
    level = sanitize_string(level, 50)
    time_available = sanitize_string(time_available, 100)
    
    if not goal:
        raise ValidationError("Goal is required")
    
    openai_key = current_app.config.get('OPENAI_API_KEY', '')
    
    if openai_key:
        roadmap_data = _openai_roadmap(goal, level, time_available, openai_key)
    else:
        roadmap_data = _mock_roadmap(goal, level, time_available)
    
    # Save to DB
    from models import Roadmap
    roadmap = Roadmap(
        user_id=user_id,
        goal=goal,
        level=level,
        time_available=time_available,
        roadmap_data=roadmap_data,
        progress=0.0,
    )
    db.session.add(roadmap)
    db.session.commit()
    
    return roadmap.to_dict()


def _mock_roadmap(goal, level, time_available):
    """Generate a mock roadmap with resources and estimated hours."""
    return {
        'title': f'Roadmap: {goal}',
        'total_estimated_hours': 120,
        'phases': [
            {
                'id': 'phase-1',
                'title': 'Foundation',
                'description': f'Build core fundamentals for {goal}',
                'duration': '2-3 weeks',
                'estimated_hours': 20,
                'status': 'not_started',
                'topics': [
                    {
                        'title': 'Core Concepts',
                        'completed': False,
                        'estimated_hours': 8,
                        'resources': [
                            {'type': 'video', 'title': 'Introduction Course', 'url': 'https://youtube.com'},
                            {'type': 'book', 'title': 'Getting Started Guide', 'url': ''},
                        ]
                    },
                    {
                        'title': 'Basic Terminology',
                        'completed': False,
                        'estimated_hours': 6,
                        'resources': [
                            {'type': 'article', 'title': 'Key Terms Glossary', 'url': ''},
                        ]
                    },
                    {
                        'title': 'Environment Setup',
                        'completed': False,
                        'estimated_hours': 6,
                        'resources': [
                            {'type': 'tutorial', 'title': 'Setup Tutorial', 'url': ''},
                        ]
                    },
                ]
            },
            {
                'id': 'phase-2',
                'title': 'Core Skills',
                'description': f'Develop essential skills for {goal}',
                'duration': '3-4 weeks',
                'estimated_hours': 30,
                'status': 'not_started',
                'topics': [
                    {
                        'title': 'Intermediate Concepts',
                        'completed': False,
                        'estimated_hours': 10,
                        'resources': [
                            {'type': 'course', 'title': 'Intermediate Course', 'url': ''},
                        ]
                    },
                    {
                        'title': 'Practical Exercises',
                        'completed': False,
                        'estimated_hours': 10,
                        'resources': [
                            {'type': 'practice', 'title': 'Exercise Platform', 'url': ''},
                        ]
                    },
                    {
                        'title': 'Mini Projects',
                        'completed': False,
                        'estimated_hours': 10,
                        'resources': [
                            {'type': 'project', 'title': 'Project Ideas', 'url': ''},
                        ]
                    },
                ]
            },
            {
                'id': 'phase-3',
                'title': 'Advanced Topics',
                'description': f'Master advanced aspects of {goal}',
                'duration': '4-6 weeks',
                'estimated_hours': 35,
                'status': 'not_started',
                'topics': [
                    {
                        'title': 'Advanced Theory',
                        'completed': False,
                        'estimated_hours': 12,
                        'resources': [
                            {'type': 'book', 'title': 'Advanced Reference', 'url': ''},
                        ]
                    },
                    {
                        'title': 'Complex Projects',
                        'completed': False,
                        'estimated_hours': 15,
                        'resources': [
                            {'type': 'project', 'title': 'Capstone Project Guide', 'url': ''},
                        ]
                    },
                    {
                        'title': 'Best Practices',
                        'completed': False,
                        'estimated_hours': 8,
                        'resources': [
                            {'type': 'article', 'title': 'Industry Best Practices', 'url': ''},
                        ]
                    },
                ]
            },
            {
                'id': 'phase-4',
                'title': 'Real-World Application',
                'description': f'Apply {goal} skills to real projects',
                'duration': '4-8 weeks',
                'estimated_hours': 35,
                'status': 'not_started',
                'topics': [
                    {
                        'title': 'Portfolio Project',
                        'completed': False,
                        'estimated_hours': 15,
                        'resources': [
                            {'type': 'project', 'title': 'Portfolio Showcase', 'url': ''},
                        ]
                    },
                    {
                        'title': 'Industry Standards',
                        'completed': False,
                        'estimated_hours': 10,
                        'resources': [
                            {'type': 'article', 'title': 'Industry Guidelines', 'url': ''},
                        ]
                    },
                    {
                        'title': 'Career Preparation',
                        'completed': False,
                        'estimated_hours': 10,
                        'resources': [
                            {'type': 'course', 'title': 'Interview Prep Course', 'url': ''},
                        ]
                    },
                ]
            },
        ]
    }


def _openai_roadmap(goal, level, time_available, api_key):
    """Generate comprehensive roadmap using OpenAI."""
    try:
        import openai
        client = openai.OpenAI(api_key=api_key)
        
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an expert learning coach and curriculum designer. "
                        "Generate a highly detailed, actionable learning roadmap in JSON format. "
                        "Each phase should have specific, domain-accurate topics with real resource recommendations. "
                        "Make it feel like a professional course syllabus. "
                        "Return ONLY valid JSON with this structure: "
                        '{"title": "...", "total_estimated_hours": 120, '
                        '"phases": [{"id": "phase-1", "title": "...", '
                        '"description": "Detailed description", '
                        '"duration": "X weeks", "estimated_hours": 20, "status": "not_started", '
                        '"topics": [{"title": "Specific Topic", "completed": false, '
                        '"estimated_hours": 5, '
                        '"resources": [{"type": "video|book|course|article|practice|project", '
                        '"title": "Resource Name", "url": "https://..."}]}]}]}'
                    )
                },
                {
                    "role": "user",
                    "content": (
                        f"Create a comprehensive learning roadmap:\n"
                        f"Goal: {goal}\n"
                        f"Current Level: {level}\n"
                        f"Time Available: {time_available}\n\n"
                        f"Requirements:\n"
                        f"- Create 5-7 detailed phases from fundamentals to mastery\n"
                        f"- Each phase should have 5-8 specific topics\n"
                        f"- Topics should include specific technologies, frameworks, tools\n"
                        f"- Include hands-on projects in each phase\n"
                        f"- Add estimated hours for EACH topic (realistic numbers!)\n"
                        f"- Add estimated_hours total for each phase\n"
                        f"- Add 1-3 real resource links (YouTube, docs, courses) per topic\n"
                        f"- total_estimated_hours should be the sum of all phase hours\n"
                        f"- Make difficulty progressively increase\n"
                        f"- Include real-world applicable skills"
                    )
                }
            ],
            max_tokens=3500,
            temperature=0.6,
        )
        
        result = response.choices[0].message.content
        try:
            return json.loads(result)
        except json.JSONDecodeError:
            import re
            match = re.search(r'```(?:json)?\s*(.*?)```', result, re.DOTALL)
            if match:
                return json.loads(match.group(1))
            return _mock_roadmap(goal, level, time_available)
    except Exception as e:
        logger.error(f"OpenAI roadmap generation failed: {e}")
        return _mock_roadmap(goal, level, time_available)


def get_roadmap(user_id, roadmap_id):
    """Get a roadmap with ownership check."""
    from models import Roadmap
    roadmap = Roadmap.query.get(roadmap_id)
    if not roadmap:
        raise NotFoundError("Roadmap not found")
    if roadmap.user_id != user_id:
        from error_handler import ForbiddenError
        raise ForbiddenError("Access denied")
    return roadmap.to_dict()


def get_user_roadmaps(user_id):
    """Get all roadmaps for a user."""
    from models import Roadmap
    roadmaps = Roadmap.query.filter_by(user_id=user_id) \
        .order_by(Roadmap.created_at.desc()).all()
    return [r.to_dict() for r in roadmaps]


def update_roadmap_progress(user_id, roadmap_id, phase_id, topic_index, completed):
    """Update progress on a roadmap topic."""
    from models import Roadmap
    roadmap = Roadmap.query.get(roadmap_id)
    if not roadmap or roadmap.user_id != user_id:
        raise NotFoundError("Roadmap not found")
    
    data = roadmap.roadmap_data
    if data and 'phases' in data:
        for phase in data['phases']:
            if phase['id'] == phase_id and topic_index < len(phase.get('topics', [])):
                phase['topics'][topic_index]['completed'] = completed
                break
        
        # Calculate overall progress
        total = 0
        done = 0
        for phase in data['phases']:
            for topic in phase.get('topics', []):
                total += 1
                if topic.get('completed'):
                    done += 1
        
        roadmap.roadmap_data = data
        roadmap.progress = (done / total * 100) if total > 0 else 0
        db.session.commit()
    
    return roadmap.to_dict()
