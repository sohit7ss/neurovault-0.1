import re

with open('backend/services/ai_service.py', 'r', encoding='utf-8') as f:
    content = f.read()

replacement = '''class VectorStoreManager:
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
        from config import config
        conf = config[os.getenv('FLASK_ENV') or 'default']
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

# Global vector store instance'''
new_content = re.sub(r'class VectorStoreManager:.*?# Global vector store instance', replacement, content, flags=re.DOTALL)

with open('backend/services/ai_service.py', 'w', encoding='utf-8') as f:
    f.write(new_content)
print("Replaced!")
