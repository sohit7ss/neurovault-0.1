"""BM25 keyword search for hybrid retrieval (vector + keyword)."""
import re
import logging
from collections import defaultdict

logger = logging.getLogger(__name__)


class BM25Index:
    """In-memory BM25 keyword search index with user isolation."""

    def __init__(self):
        self._user_docs = defaultdict(list)  # {user_id: [(doc_id, chunk_idx, text), ...]}
        self._user_index = {}  # {user_id: BM25Okapi instance}

    def _tokenize(self, text):
        """Simple tokenizer: lowercase, split by non-alpha, remove stopwords."""
        stopwords = {
            'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
            'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
            'would', 'could', 'should', 'may', 'might', 'can', 'shall',
            'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
            'as', 'into', 'through', 'during', 'before', 'after', 'and',
            'but', 'or', 'nor', 'not', 'so', 'yet', 'both', 'either',
            'neither', 'each', 'every', 'all', 'any', 'few', 'more',
            'most', 'other', 'some', 'such', 'no', 'only', 'own', 'same',
            'than', 'too', 'very', 'just', 'because', 'if', 'when',
            'where', 'how', 'what', 'which', 'who', 'whom', 'this',
            'that', 'these', 'those', 'it', 'its', 'he', 'she', 'they',
            'them', 'their', 'we', 'our', 'you', 'your', 'my', 'me',
        }
        tokens = re.findall(r'\b[a-z]{2,}\b', text.lower())
        return [t for t in tokens if t not in stopwords]

    def add_chunks(self, user_id, document_id, chunks):
        """Add document chunks to the BM25 index for a user."""
        for i, chunk_text in enumerate(chunks):
            self._user_docs[user_id].append((document_id, i, chunk_text))
        self._rebuild_user_index(user_id)

    def _rebuild_user_index(self, user_id):
        """Rebuild BM25 index for a specific user."""
        try:
            from rank_bm25 import BM25Okapi
            docs = self._user_docs.get(user_id, [])
            if not docs:
                self._user_index.pop(user_id, None)
                return
            tokenized = [self._tokenize(d[2]) for d in docs]
            self._user_index[user_id] = BM25Okapi(tokenized)
        except ImportError:
            logger.warning("rank_bm25 not installed, keyword search disabled")
        except Exception as e:
            logger.error(f"BM25 index build failed: {e}")

    def search(self, user_id, query, top_k=10):
        """Search user's documents using BM25 keyword matching."""
        if user_id not in self._user_index:
            return []
        try:
            index = self._user_index[user_id]
            tokens = self._tokenize(query)
            if not tokens:
                return []
            scores = index.get_scores(tokens)
            docs = self._user_docs[user_id]

            results = []
            scored_pairs = sorted(enumerate(scores), key=lambda x: -x[1])
            for idx, score in scored_pairs[:top_k]:
                if score <= 0:
                    break
                doc_id, chunk_idx, chunk_text = docs[idx]
                results.append({
                    'chunk_text': chunk_text,
                    'document_id': doc_id,
                    'chunk_index': chunk_idx,
                    'score': float(score),
                    'source': 'bm25',
                })
            return results
        except Exception as e:
            logger.error(f"BM25 search failed: {e}")
            return []

    def remove_document(self, user_id, document_id):
        """Remove a document's chunks from the index."""
        if user_id in self._user_docs:
            self._user_docs[user_id] = [
                d for d in self._user_docs[user_id] if d[0] != document_id
            ]
            self._rebuild_user_index(user_id)


# Singleton
_bm25_index = None


def get_bm25_index():
    global _bm25_index
    if _bm25_index is None:
        _bm25_index = BM25Index()
    return _bm25_index
