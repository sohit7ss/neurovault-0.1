"""AI service: RAG pipeline, embeddings, vector store, roadmap generation."""
import os
import json
import pickle
import logging
import numpy as np
from flask import current_app
from error_handler import NotFoundError, ValidationError
from security import sanitize_string
from supabase_client import sb_select, sb_insert, sb_update, sb_delete
from services.rate_limiter import gemini_rate_limiter

logger = logging.getLogger(__name__)

# Gemini Model Configuration
GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_FALLBACK = "gemini-2.5-flash-lite"

def call_gemini(model_obj, prompt, generation_config=None):
    """Call Gemini with fallback logic."""
    import google.generativeai as genai
    gemini_rate_limiter.wait()
    try:
        # We assume model_obj is already initialized with GEMINI_MODEL
        return model_obj.generate_content(prompt, generation_config=generation_config)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Primary model {GEMINI_MODEL} failed, trying fallback {GEMINI_FALLBACK}: {e}")
        fallback_model = genai.GenerativeModel(GEMINI_FALLBACK)
        return fallback_model.generate_content(prompt, generation_config=generation_config)

# ---------- Vector Store Manager ----------

class VectorStoreManager:
    """Manages embeddings with pure Python fallback for Python 3.14+ compatibility."""
    
    def __init__(self, store_path):
        import os
        self.store_path = store_path
        self.metadata = []  # List of {user_id, document_id, chunk_index, chunk_text, embedding: list[float]}
        self.dimension = 768  # Gemini default dimension
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
    
    def get_huggingface_client(self):
        import os
        from flask import current_app
        return current_app.config.get('HUGGINGFACE_API_KEY')
        
    def get_gemini_client(self):
        import os
        from flask import current_app
        return current_app.config.get('GEMINI_API_KEY')
    
    def embed_texts(self, texts):
        """Generate embeddings using Gemini or Hugging Face Inference API."""
        import requests
        
        # 1. Try Gemini first (Best quality, 768 dimensions)
        gemini_key = self.get_gemini_client()
        if gemini_key:
            try:
                import google.generativeai as genai
                genai.configure(api_key=gemini_key)
                # Using models/embedding-001 or text-embedding-004
                result = genai.embed_content(
                    model="models/embedding-001",
                    content=texts,
                    task_type="retrieval_document"
                )
                embeddings = result['embedding']
                if embeddings and len(embeddings) > 0:
                    self.dimension = len(embeddings[0])
                    return embeddings
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(f"Gemini embedding failed: {e}")
                
        # 2. Fallback to Hugging Face (384 dimensions)
        hf_key = self.get_huggingface_client()
        if hf_key:
            try:
                model_id = "sentence-transformers/all-MiniLM-L6-v2"
                api_url = f"https://api-inference.huggingface.co/pipeline/feature-extraction/{model_id}"
                headers = {"Authorization": f"Bearer {hf_key}"}
                
                response = requests.post(api_url, headers=headers, json={"inputs": texts})
                if response.status_code == 200:
                    embeddings = response.json()
                    self.dimension = len(embeddings[0])
                    return embeddings
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(f"HF embedding failed: {e}")
        
        # 3. Last resort Mock embedding (random) for development without ML libs
        import random
        import logging
        logging.getLogger(__name__).warning("Using RANDOM embeddings. Search will not work correctly.")
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
    
    def search(self, user_id, query_text, top_k=10, document_ids=None):
        """Search vector store filtered by user_id or document_ids using pure Python Cosine Similarity."""
        if not self.metadata:
            return []
            
        if document_ids is not None:
            # Search within a specific set of documents (e.g. workspace docs)
            docs_to_search = [m for m in self.metadata if m.get('document_id') in document_ids]
        else:
            # Default to user's personal documents
            docs_to_search = [m for m in self.metadata if m.get('user_id') == user_id]
            
        if not docs_to_search:
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
        for doc in docs_to_search:
            if 'embedding' not in doc:
                continue
            
            # Handle dimension mismatch (e.g., if old random vectors had 1536 but new Gemini has 768)
            if len(doc['embedding']) != len(query_embedding):
                continue
                
            sim = cosine_similarity(query_embedding, doc['embedding'])
            # We treat distance as 1 - similarity so lower is better (Like FAISS L2)
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
    document = sb_select('documents', eq=('id', document_id), single=True)
    if not document or document.get('user_id') != user_id:
        raise NotFoundError("Document not found")
    
    content_text = document.get('content_text')
    if not content_text:
        return {'message': 'No text content to process'}
    
    # Chunk the text
    chunks = chunk_text(
        content_text,
        chunk_size=current_app.config.get('CHUNK_SIZE', 500),
        overlap=current_app.config.get('CHUNK_OVERLAP', 50),
    )
    
    # Add to vector store
    vs = get_vector_store()
    vs.add_chunks(user_id, document_id, chunks)
    
    # Save embedding metadata to Supabase
    for i, chunk in enumerate(chunks):
        sb_insert('embeddings', {
            'user_id': user_id,
            'document_id': document_id,
            'chunk_index': i,
            'chunk_text': chunk,
            'vector_id': f"{document_id}_{i}",
        })
    
    # Update document status
    sb_update('documents', match={'id': document_id}, data={'status': 'ready'})
    
    return {
        'message': f'Processed {len(chunks)} chunks',
        'chunks_count': len(chunks),
    }


def query_documents(user_id, query, top_k=5, workspace_id=None):
    """RAG query: hybrid search (vector + BM25) with query rewriting.
    Falls back to general AI knowledge if no documents are found."""
    query = sanitize_string(query, 2000)
    if not query:
        raise ValidationError("Query cannot be empty")
    
    # Query rewriting for better search
    expanded_query = rewrite_query(query)
    
    document_ids = None
    if workspace_id:
        # Fetch all documents shared in this workspace
        ws_docs = sb_select('workspace_documents', eq=('workspace_id', workspace_id))
        document_ids = [d['document_id'] for d in (ws_docs or [])]
        if not document_ids:
            # If workspace has no documents, return empty RAG results immediately or fallback
            return {
                'answer': "This workspace has no shared documents to search from.",
                'sources': [],
                'query': query,
                'mode': 'workspace_empty',
            }

    vs = get_vector_store()
    
    # Vector search with user isolation or workspace document isolation
    vector_results = vs.search(
        user_id if not workspace_id else None, 
        expanded_query,
        top_k=current_app.config.get('TOP_K_RESULTS', 10),
        document_ids=document_ids
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
    
    # ── FALLBACK: If no documents, use general AI knowledge ──
    if not merged:
        general_answer = _general_ai_answer(query)
        return {
            'answer': general_answer,
            'sources': [],
            'query': query,
            'mode': 'general_knowledge',
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
        doc_id = r['document_id']
        if doc_id not in seen_docs:
            doc = sb_select('documents', eq=('id', doc_id), single=True)
            if doc:
                sources.append({
                    'document_id': doc['id'],
                    'title': doc['title'],
                    'relevance': r['score'],
                })
                seen_docs.add(doc_id)
    
    return {
        'answer': answer,
        'sources': sources,
        'query': query,
        'chunks_used': len(context_parts),
        'mode': 'document_rag',
    }


def _general_ai_answer(query):
    """Generate an answer using general AI knowledge (no document context)."""
    gemini_key = current_app.config.get('GEMINI_API_KEY', '')
    
    if gemini_key:
        try:
            import google.generativeai as genai
            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel(GEMINI_MODEL)
            
            prompt = (
                "You are NeuroVault, an expert AI knowledge assistant. "
                "The user has no documents uploaded yet, so answer from your general knowledge. "
                "Provide a comprehensive, highly-structured response.\n\n"
                "Format your response in rich markdown:\n"
                "- Use **bold** for key terms and *italics* for emphasis\n"
                "- Use ## headings to organize sections\n"
                "- Use bullet points and numbered lists\n"
                "- Use LaTeX math with $...$ for inline and $$...$$ for display math\n"
                "- Use ```language for code blocks\n"
                "- Use > for important definitions or callouts\n"
                "- Use tables when comparing items\n"
                "- Be extremely thorough and educational, like a premium GPT model textbook explanation\n\n"
                "At the end, add a note: '---\n\n"
                "💡 *This answer is from general AI knowledge. "
                "Upload your own documents for personalized, context-aware answers!*'\n\n"
                f"Question: {query}"
            )
            
            response = call_gemini(model, prompt)
            return response.text
        except Exception as e:
            logger.error(f"Gemini general answer error: {e}")
    
    return (
        f"## {query}\n\n"
        "I don't have any documents uploaded to search through yet, "
        "and the AI service is currently unavailable.\n\n"
        "**To get the best experience:**\n"
        "1. Upload your study materials, notes, or PDFs in the **Documents** section\n"
        "2. Come back here and ask questions — I'll search through YOUR content\n"
        "3. You'll get personalized, context-aware answers from your own knowledge base\n\n"
        "---\n\n"
        "*💡 Tip: Even without documents, I can answer general questions when the AI service is configured.*"
    )


def _generate_answer(query, context):
    """Generate answer using LLM. Falls back to smart extraction if no API key."""
    gemini_key = current_app.config.get('GEMINI_API_KEY', '')
    
    if gemini_key:
        result = _gemini_answer(query, context, gemini_key)
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
        f"*💡 For high-quality AI-generated answers, ensure your Gemini API key is valid in the .env file.*"
    )


def _gemini_answer(query, context, api_key):
    """Generate answer using Gemini API with rich markdown formatting."""
    try:
        import google.generativeai as genai
        
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(GEMINI_MODEL)
        
        prompt = (
            "You are an elite AI assistant for a premium knowledge platform. "
            "Answer the user's question with utmost precision based ONLY on the provided context from their documents. "
            "Format your response in rich markdown like a highly advanced GPT model:\n"
            "- Use **bold** for key terms and *italics* for emphasis\n"
            "- Use structured ## and ### headings to organize sections logically\n"
            "- Use bullet points and numbered lists for clarity\n"
            "- Use LaTeX math notation with $ for inline (e.g. $E = mc^2$) and $$ for display math\n"
            "- Use ```language for code blocks\n"
            "- Use > for important quotes or definitions\n"
            "- Use markdown tables when comparing items or listing related data\n"
            "- Extract maximum value from the context. Be highly thorough, educational, and well-structured.\n"
            "- Do not hallucinate outside the context. If the answer isn't firmly in the text, clearly state that.\n\n"
            f"Context from the user's documents:\n{context}\n\nQuestion: {query}"
        )
        
        response = call_gemini(model, prompt)
        return response.text
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Gemini API error: {e}")
        return f"**Gemini API Error:**\n\n```text\n{str(e)}\n```\n\nPlease check your API key, region, and quotas."


# ---------- Roadmap Generator ----------

def generate_roadmap(user_id, goal, level='beginner', time_available='2 hours/day'):
    """Generate a learning roadmap based on goal."""
    goal = sanitize_string(goal, 500)
    level = sanitize_string(level, 50)
    time_available = sanitize_string(time_available, 100)
    
    if not goal:
        raise ValidationError("Goal is required")
    
    openrouter_key = current_app.config.get('OPENROUTER_API_KEY', '')
    gemini_key = current_app.config.get('GEMINI_API_KEY', '')
    
    if openrouter_key:
        roadmap_data = _openrouter_roadmap(goal, level, time_available, openrouter_key)
    elif gemini_key:
        roadmap_data = _gemini_roadmap(goal, level, time_available, gemini_key)
    else:
        roadmap_data = _smart_mock_roadmap(goal, level, time_available)
    
    # Save to Supabase
    res = sb_insert('roadmaps', {
        'user_id': user_id,
        'goal': goal,
        'level': level,
        'time_available': time_available,
        'roadmap_data': roadmap_data,
        'progress': 0.0,
    })
    
    roadmap = res.data[0] if res.data else None
    return roadmap


def _gemini_roadmap(goal, level, time_available, api_key):
    """Generate a comprehensive roadmap using Gemini API."""
    try:
        import google.generativeai as genai
        import json
        
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(GEMINI_MODEL)
        
        prompt = (
            "You are a world-class curriculum designer. Create an extremely detailed learning roadmap strictly tailored to the requested user level.\n\n"
            f"TOPIC: {goal}\nLEVEL: {level}\nTIME: {time_available}\n\n"
            "CRITICAL INSTRUCTION: You MUST strictly adapt the content depth, complexity, math, and scope to the specified LEVEL. "
            "If the level is a school grade (e.g., 'class 10', 'high school') or 'beginner', DO NOT include advanced university-level or professional topics. "
            "Keep the explanations, subtopics, and resources perfectly aligned with the target audience's grade or proficiency level, simplifying concepts where necessary.\n\n"
            "Create 5-6 phases, each with 4-6 specific topics. Each topic must have:\n"
            "- Specific title (NOT generic like 'Core Concepts')\n"
            "- Description of what it covers\n"
            "- List of subtopics (3-5 items)\n"
            "- 2-4 resources with REAL URLs:\n"
            "  * YouTube: https://youtube.com/results?search_query=ENCODED+TOPIC\n"
            "  * Docs: official documentation URLs\n"
            "  * Free courses: freeCodeCamp, Khan Academy, Coursera, MIT OCW\n"
            "  * Practice: LeetCode, HackerRank, GeeksForGeeks\n"
            "- Difficulty level (easy/medium/hard)\n"
            "- Estimated hours\n\n"
            "Return ONLY valid JSON:\n"
            '{"title": "...", "total_estimated_hours": N, '
            '"phases": [{"id": "phase-1", "title": "...", '
            '"description": "...", "prerequisites": "...", '
            '"duration": "X weeks", "estimated_hours": N, "status": "not_started", '
            '"topics": [{"title": "...", "description": "...", '
            '"subtopics": ["..."], "completed": false, '
            '"estimated_hours": N, "difficulty": "easy|medium|hard", '
            '"resources": [{"type": "video|course|docs|article|practice", '
            '"title": "...", "url": "https://..."}]}]}]}'
        )
        
        response = call_gemini(model, prompt)
        text = response.text.strip()
        
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            import re
            match = re.search(r'```(?:json)?\s*(.*?)```', text, re.DOTALL)
            if match:
                return json.loads(match.group(1))
            # Try finding JSON object
            match = re.search(r'\{.*\}', text, re.DOTALL)
            if match:
                return json.loads(match.group(0))
    except Exception as e:
        logger.error(f"Gemini roadmap failed: {e}")
    
    return _smart_mock_roadmap(goal, level, time_available)


def _smart_mock_roadmap(goal, level, time_available):
    """Generate a detailed mock roadmap with topic-aware content and real resource URLs."""
    import urllib.parse
    g = goal.strip()
    q = urllib.parse.quote_plus(g)
    
    return {
        'title': f'Complete Learning Roadmap: {g}',
        'total_estimated_hours': 160,
        'phases': [
            {
                'id': 'phase-1',
                'title': f'Foundation & Setup',
                'description': f'Build a strong foundation in {g}. Understand the core concepts, terminology, history, and set up your learning environment.',
                'prerequisites': 'Basic computer literacy, curiosity to learn',
                'duration': '2-3 weeks',
                'estimated_hours': 25,
                'status': 'not_started',
                'topics': [
                    {
                        'title': f'Introduction to {g}',
                        'description': f'Understand what {g} is, its history, why it matters, and where it is used in the real world.',
                        'subtopics': [f'What is {g}?', f'History & Evolution of {g}', f'Real-world applications', 'Key terminology & jargon', 'Community & ecosystem overview'],
                        'completed': False,
                        'estimated_hours': 6,
                        'difficulty': 'easy',
                        'resources': [
                            {'type': 'video', 'title': f'{g} Crash Course for Beginners', 'url': f'https://youtube.com/results?search_query={q}+crash+course+beginners'},
                            {'type': 'article', 'title': f'{g} Overview - Wikipedia', 'url': f'https://en.wikipedia.org/wiki/{q}'},
                            {'type': 'article', 'title': f'Introduction to {g} - GeeksForGeeks', 'url': f'https://www.geeksforgeeks.org/{q.lower().replace("+", "-")}/'},
                        ]
                    },
                    {
                        'title': f'Resources & Setup',
                        'description': f'Gather the necessary materials, books, software, or tools required to master {g}.',
                        'subtopics': ['Resource gathering', 'Identifying primary sources', 'Organizing your study space', 'Finding community forums', 'Bookmarking essential references'],
                        'completed': False,
                        'estimated_hours': 5,
                        'difficulty': 'easy',
                        'resources': [
                            {'type': 'video', 'title': f'Best tools for {g}', 'url': f'https://youtube.com/results?search_query={q}+best+resources+tools'},
                            {'type': 'docs', 'title': f'Essential {g} Guide', 'url': f'https://www.google.com/search?q={q}+essential+getting+started+guide'},
                        ]
                    },
                    {
                        'title': f'Core Fundamentals of {g}',
                        'description': f'Learn the essential building blocks that everything else in {g} is built upon.',
                        'subtopics': [f'Basic {g} concepts', 'Fundamental principles', 'Common patterns', 'Hands-on first examples', 'Troubleshooting basics'],
                        'completed': False,
                        'estimated_hours': 8,
                        'difficulty': 'easy',
                        'resources': [
                            {'type': 'course', 'title': f'{g} Fundamentals - freeCodeCamp', 'url': f'https://www.freecodecamp.org/news/tag/{q.lower().replace("+", "-")}/'},
                            {'type': 'video', 'title': f'{g} Full Course for Beginners', 'url': f'https://youtube.com/results?search_query={q}+full+course+beginners+freeCodeCamp'},
                            {'type': 'practice', 'title': f'Practice {g} - W3Schools', 'url': f'https://www.w3schools.com/{q.lower().split("+")[0]}/'},
                        ]
                    },
                    {
                        'title': 'First Mini-Project',
                        'description': f'Apply what you\'ve learned by building a small, guided project using basic {g} concepts.',
                        'subtopics': ['Project planning', 'Step-by-step implementation', 'Testing your work', 'Common pitfalls to avoid'],
                        'completed': False,
                        'estimated_hours': 6,
                        'difficulty': 'easy',
                        'resources': [
                            {'type': 'project', 'title': f'{g} Beginner Project Ideas', 'url': f'https://youtube.com/results?search_query={q}+beginner+project+tutorial'},
                            {'type': 'article', 'title': f'Top {g} Projects for Beginners', 'url': f'https://www.google.com/search?q=best+{q}+beginner+projects'},
                        ]
                    },
                ]
            },
            {
                'id': 'phase-2',
                'title': 'Intermediate Concepts',
                'description': f'Deepen your understanding of {g} with intermediate-level concepts and techniques.',
                'prerequisites': 'Phase 1 completed',
                'duration': '3-4 weeks',
                'estimated_hours': 35,
                'status': 'not_started',
                'topics': [
                    {
                        'title': f'Intermediate {g} Techniques',
                        'description': f'Move beyond basics to learn powerful patterns and techniques used in real {g} work.',
                        'subtopics': ['Design patterns', 'Advanced syntax/features', 'Error handling', 'Performance basics', 'Code organization'],
                        'completed': False,
                        'estimated_hours': 10,
                        'difficulty': 'medium',
                        'resources': [
                            {'type': 'course', 'title': f'Intermediate {g} Course', 'url': f'https://youtube.com/results?search_query={q}+intermediate+course'},
                            {'type': 'article', 'title': f'{g} Best Practices', 'url': f'https://www.google.com/search?q={q}+best+practices+guide'},
                        ]
                    },
                    {
                        'title': f'Practical Applications of {g}',
                        'description': f'Learn how to solve complex problems and apply {g} in practical, real-world scenarios.',
                        'subtopics': ['Common use cases', 'Problem-solving strategies', 'Case studies', 'Best practices', 'Applied examples'],
                        'completed': False,
                        'estimated_hours': 10,
                        'difficulty': 'medium',
                        'resources': [
                            {'type': 'practice', 'title': f'Applied {g} Exercises', 'url': f'https://www.google.com/search?q={q}+practice+exercises'},
                            {'type': 'video', 'title': f'Real-world {g} Examples', 'url': f'https://youtube.com/results?search_query={q}+real+world+examples'},
                        ]
                    },
                    {
                        'title': f'Evaluation & Validation in {g}',
                        'description': f'Learn how to evaluate your understanding, test your work, and ensure quality.',
                        'subtopics': ['Self-assessment techniques', 'Peer review', 'Critique methods', 'Common mistakes to avoid'],
                        'completed': False,
                        'estimated_hours': 8,
                        'difficulty': 'medium',
                        'resources': [
                            {'type': 'video', 'title': f'{g} Common Mistakes', 'url': f'https://youtube.com/results?search_query={q}+common+mistakes'},
                            {'type': 'article', 'title': f'Evaluating {g} Quality', 'url': f'https://www.google.com/search?q=how+to+evaluate+{q}'},
                        ]
                    },
                    {
                        'title': 'Intermediate Projects',
                        'description': f'Build 2-3 intermediate projects that combine multiple {g} concepts.',
                        'subtopics': ['Project scoping', 'Architecture decisions', 'Building from scratch', 'Code review & refactoring', 'Documentation'],
                        'completed': False,
                        'estimated_hours': 7,
                        'difficulty': 'medium',
                        'resources': [
                            {'type': 'project', 'title': f'{g} Intermediate Projects', 'url': f'https://youtube.com/results?search_query={q}+intermediate+project+tutorial'},
                            {'type': 'article', 'title': f'Project Ideas for {g}', 'url': f'https://www.google.com/search?q={q}+intermediate+project+ideas'},
                        ]
                    },
                ]
            },
            {
                'id': 'phase-3',
                'title': 'Advanced Mastery',
                'description': f'Master advanced {g} concepts, optimization, and professional-grade techniques.',
                'prerequisites': 'Phase 2 completed',
                'duration': '4-6 weeks',
                'estimated_hours': 40,
                'status': 'not_started',
                'topics': [
                    {
                        'title': f'Advanced {g} Patterns & Architecture',
                        'description': f'Study advanced design patterns, system architecture, and scalable approaches in {g}.',
                        'subtopics': ['Advanced design patterns', 'System architecture', 'Scalability', 'Security considerations', 'Performance optimization'],
                        'completed': False,
                        'estimated_hours': 12,
                        'difficulty': 'hard',
                        'resources': [
                            {'type': 'course', 'title': f'Advanced {g} - MIT OCW', 'url': f'https://ocw.mit.edu/search/?q={q}'},
                            {'type': 'video', 'title': f'Advanced {g} Concepts', 'url': f'https://youtube.com/results?search_query={q}+advanced+concepts+tutorial'},
                            {'type': 'article', 'title': f'Advanced {g} Patterns', 'url': f'https://www.google.com/search?q=advanced+{q}+design+patterns'},
                        ]
                    },
                    {
                        'title': f'Performance & Optimization',
                        'description': f'Learn to profile, benchmark, and optimize {g} code for production.',
                        'subtopics': ['Profiling tools', 'Memory optimization', 'Speed optimization', 'Caching strategies', 'Monitoring & observability'],
                        'completed': False,
                        'estimated_hours': 10,
                        'difficulty': 'hard',
                        'resources': [
                            {'type': 'video', 'title': f'{g} Performance Optimization', 'url': f'https://youtube.com/results?search_query={q}+performance+optimization'},
                            {'type': 'article', 'title': f'Performance Tips for {g}', 'url': f'https://www.google.com/search?q={q}+performance+optimization+tips'},
                        ]
                    },
                    {
                        'title': 'Capstone Project',
                        'description': f'Build a significant, portfolio-worthy project showcasing your {g} expertise.',
                        'subtopics': ['Project planning & design', 'Full implementation', 'Deployment', 'Documentation', 'Code review'],
                        'completed': False,
                        'estimated_hours': 18,
                        'difficulty': 'hard',
                        'resources': [
                            {'type': 'project', 'title': f'Advanced {g} Project Ideas', 'url': f'https://youtube.com/results?search_query={q}+advanced+project'},
                            {'type': 'article', 'title': f'Portfolio Project Ideas for {g}', 'url': f'https://dev.to/search?q={q}+project'},
                        ]
                    },
                ]
            },
            {
                'id': 'phase-4',
                'title': 'Professional Development & Career',
                'description': f'Prepare for professional work with {g}: industry standards, interviews, and career growth.',
                'prerequisites': 'Phase 3 completed',
                'duration': '3-4 weeks',
                'estimated_hours': 30,
                'status': 'not_started',
                'topics': [
                    {
                        'title': f'{g} in the Industry / Advanced Context',
                        'description': f'Learn how {g} is utilized in professional, academic, or high-level environments.',
                        'subtopics': ['Industry workflows', 'Academic importance', 'Collaboration', 'Research frontiers'],
                        'completed': False,
                        'estimated_hours': 8,
                        'difficulty': 'medium',
                        'resources': [
                            {'type': 'article', 'title': f'{g} Industry Best Practices', 'url': f'https://www.google.com/search?q={q}+industry+best+practices'},
                            {'type': 'video', 'title': f'{g} Applications', 'url': f'https://youtube.com/results?search_query={q}+real+world+applications'},
                        ]
                    },
                    {
                        'title': f'Assessment & Proficiency Check for {g}',
                        'description': f'Rigorous testing of your advanced {g} concepts and mastery.',
                        'subtopics': ['Advanced problem sets', 'Theoretical challenges', 'Practical implementation', 'Peer discussions'],
                        'completed': False,
                        'estimated_hours': 10,
                        'difficulty': 'hard',
                        'resources': [
                            {'type': 'practice', 'title': f'{g} Advanced Practice', 'url': f'https://www.google.com/search?q={q}+advanced+practice'},
                            {'type': 'video', 'title': f'{g} Expert Explanations', 'url': f'https://youtube.com/results?search_query={q}+expert+level'},
                        ]
                    },
                    {
                        'title': 'Community Contribution & Sharing',
                        'description': f'Learn to contribute to the {g} community, share knowledge, and build your reputation.',
                        'subtopics': ['Finding discussion forums', 'Reading advanced literature', 'Presenting findings', 'Answering questions'],
                        'completed': False,
                        'estimated_hours': 8,
                        'difficulty': 'medium',
                        'resources': [
                            {'type': 'article', 'title': f'Contributing to {g}', 'url': f'https://www.google.com/search?q=contribute+to+{q}'},
                            {'type': 'video', 'title': 'How to Share Knowledge', 'url': 'https://youtube.com/results?search_query=how+to+teach+what+you+learn'},
                        ]
                    },
                    {
                        'title': 'Building Your Portfolio & Resume',
                        'description': 'Create a compelling portfolio and resume showcasing your skills.',
                        'subtopics': ['Portfolio website', 'Project showcase', 'Resume writing', 'LinkedIn optimization', 'Networking strategies'],
                        'completed': False,
                        'estimated_hours': 4,
                        'difficulty': 'easy',
                        'resources': [
                            {'type': 'article', 'title': 'How to Build a Developer Portfolio', 'url': 'https://www.freecodecamp.org/news/how-to-build-a-developer-portfolio-website/'},
                            {'type': 'video', 'title': 'Portfolio Building Tutorial', 'url': 'https://youtube.com/results?search_query=developer+portfolio+website+tutorial'},
                        ]
                    },
                ]
            },
            {
                'id': 'phase-5',
                'title': 'Continuous Learning & Specialization',
                'description': f'Stay current with {g} developments and choose a specialization path.',
                'prerequisites': 'Phase 4 completed',
                'duration': 'Ongoing',
                'estimated_hours': 30,
                'status': 'not_started',
                'topics': [
                    {
                        'title': f'Staying Updated with {g}',
                        'description': f'Build habits for keeping up with the latest in {g}.',
                        'subtopics': ['Following key blogs & newsletters', 'Attending conferences/meetups', 'Reading release notes', 'Twitter/Reddit communities', 'Podcasts'],
                        'completed': False,
                        'estimated_hours': 5,
                        'difficulty': 'easy',
                        'resources': [
                            {'type': 'article', 'title': f'{g} Communities on Reddit', 'url': f'https://www.reddit.com/search/?q={q}'},
                            {'type': 'article', 'title': f'{g} News & Updates', 'url': f'https://dev.to/t/{q.lower().split("+")[0]}'},
                        ]
                    },
                    {
                        'title': f'Specialization in {g}',
                        'description': f'Pick a niche within {g} to specialize in and become an expert.',
                        'subtopics': ['Choose a specialization', 'Deep-dive learning', 'Building expertise', 'Speaking/writing about it', 'Mentoring others'],
                        'completed': False,
                        'estimated_hours': 15,
                        'difficulty': 'hard',
                        'resources': [
                            {'type': 'article', 'title': f'{g} Career Paths & Specializations', 'url': f'https://www.google.com/search?q={q}+career+paths+specializations'},
                            {'type': 'video', 'title': f'{g} Career Roadmap', 'url': f'https://youtube.com/results?search_query={q}+career+roadmap+2024'},
                        ]
                    },
                    {
                        'title': 'Teaching & Mentoring',
                        'description': f'Solidify your expertise by teaching and mentoring others in {g}.',
                        'subtopics': ['Creating tutorials', 'Blogging about ' + g, 'Mentoring beginners', 'Stack Overflow contributions', 'Community leadership'],
                        'completed': False,
                        'estimated_hours': 10,
                        'difficulty': 'medium',
                        'resources': [
                            {'type': 'article', 'title': 'How to Write Technical Tutorials', 'url': 'https://www.freecodecamp.org/news/how-to-write-a-technical-blog-post/'},
                            {'type': 'article', 'title': 'Becoming a Tech Mentor', 'url': 'https://www.google.com/search?q=how+to+become+a+tech+mentor'},
                        ]
                    },
                ]
            },
        ]
    }


def _mock_roadmap(goal, level, time_available):
    """Backward-compatible wrapper."""
    return _smart_mock_roadmap(goal, level, time_available)


def _openrouter_roadmap(goal, level, time_available, api_key):
    """Generate comprehensive roadmap using OpenRouter API."""
    try:
        import requests
        import json
        from flask import current_app
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "HTTP-Referer": current_app.config.get("FRONTEND_URL", "http://localhost:3000"),
            "X-Title": "NeuroVault",
            "Content-Type": "application/json"
        }
        
        prompt = (
            "You are a world-class curriculum designer and learning coach with deep expertise across all fields. "
            "Create an extremely detailed, comprehensive, and actionable learning roadmap.\n\n"
            "CRITICAL REQUIREMENTS:\n"
            f"- TOPIC: {goal}\n"
            f"- LEVEL: {level}\n"
            f"- TIME: {time_available}\n\n"
            "INSTRUCTIONS (follow exactly):\n"
            "1. Create 5-6 learning phases, each with 4-6 specific topics\n"
            "2. Each topic must list ALL important subtopics the learner needs to master\n"
            "3. Each topic MUST have 2-4 resources with REAL, working URLs:\n"
            "   - YouTube tutorials (use https://youtube.com/results?search_query=TOPIC+tutorial)\n"
            "   - Documentation (official docs like MDN, Python docs, React docs, etc.)\n"
            "   - Free courses (freeCodeCamp, Khan Academy, Coursera, MIT OCW)\n"
            "   - Practice sites (LeetCode, HackerRank, Exercism, Codecademy)\n"
            "   - Articles (Medium, Dev.to, GeeksForGeeks, W3Schools)\n"
            "4. Topics must be specific, NOT generic (e.g., 'Variables, Data Types & Operators' not 'Core Concepts')\n"
            "5. Include prerequisites, difficulty estimate, and a clear description for each phase\n"
            "6. Estimated hours must be realistic for the user's available time\n\n"
            "Return ONLY valid JSON (no markdown, no explanation) with this structure:\n"
            '{"title": "Complete Roadmap: TOPIC", "total_estimated_hours": N, '
            '"phases": [{"id": "phase-1", "title": "Phase Title", '
            '"description": "Detailed description of what learner will achieve", '
            '"prerequisites": "What learner needs before this phase", '
            '"duration": "X-Y weeks", "estimated_hours": N, "status": "not_started", '
            '"topics": [{"title": "Specific Topic Name", '
            '"description": "What this covers and why it matters", '
            '"subtopics": ["Subtopic 1", "Subtopic 2", "Subtopic 3"], '
            '"completed": false, "estimated_hours": N, '
            '"difficulty": "easy|medium|hard", '
            '"resources": [{"type": "video|book|course|article|practice|project|docs", '
            '"title": "Resource Name", "url": "https://actual-url.com/..."}]}]}]}'
        )
        
        data = {
            "model": "mistralai/mixtral-8x7b-instruct",
            "messages": [
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.4,
            "max_tokens": 4000
        }
        
        response = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=data)
        if response.status_code == 200:
            result = response.json()['choices'][0]['message']['content']
            try:
                return json.loads(result)
            except json.JSONDecodeError:
                import re
                match = re.search(r'```(?:json)?\s*(.*?)```', result, re.DOTALL)
                if match:
                    return json.loads(match.group(1))
        
        # If OpenRouter fails, try Gemini
        gemini_key = current_app.config.get('GEMINI_API_KEY', '')
        if gemini_key:
            return _gemini_roadmap(goal, level, time_available, gemini_key)
        return _smart_mock_roadmap(goal, level, time_available)
    except Exception as e:
        logger.error(f"OpenRouter roadmap generation failed: {e}")
        gemini_key = current_app.config.get('GEMINI_API_KEY', '')
        if gemini_key:
            return _gemini_roadmap(goal, level, time_available, gemini_key)
        return _smart_mock_roadmap(goal, level, time_available)


def get_roadmap(user_id, roadmap_id):
    """Get a roadmap with ownership check."""
    roadmap = sb_select('roadmaps', eq=('id', roadmap_id), single=True)
    if not roadmap:
        raise NotFoundError("Roadmap not found")
    if roadmap.get('user_id') != user_id:
        from error_handler import ForbiddenError
        raise ForbiddenError("Access denied")
    return roadmap


def get_user_roadmaps(user_id):
    """Get all roadmaps for a user."""
    # Supabase select ordered by created_at DESC
    from supabase_client import get_supabase
    res = get_supabase().table('roadmaps') \
        .select("*") \
        .eq('user_id', user_id) \
        .order('created_at', desc=True) \
        .execute()
    return res.data


def update_roadmap_progress(user_id, roadmap_id, phase_id, topic_index, completed):
    """Update progress on a roadmap topic."""
    roadmap = sb_select('roadmaps', eq=('id', roadmap_id), single=True)
    if not roadmap or roadmap.get('user_id') != user_id:
        raise NotFoundError("Roadmap not found")
    
    data = roadmap.get('roadmap_data', {})
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
        
        new_progress = (done / total * 100) if total > 0 else 0
        sb_update('roadmaps', match={'id': roadmap_id}, data={
            'roadmap_data': data,
            'progress': new_progress
        })
        roadmap['roadmap_data'] = data
        roadmap['progress'] = new_progress
    
    return roadmap
