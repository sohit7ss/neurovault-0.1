-- ============================================
-- Missing tables for NeuroVault
-- Run this in your Supabase SQL Editor
-- ============================================

-- Activity Logs table
CREATE TABLE IF NOT EXISTS activity_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    details TEXT DEFAULT '',
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Embeddings table (needed for AI Search / RAG)
CREATE TABLE IF NOT EXISTS embeddings (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    embedding VECTOR(384),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disable RLS on new tables
ALTER TABLE activity_logs DISABLE ROW LEVEL SECURITY;

-- Note: embeddings table may fail if pgvector extension is not enabled.
-- If so, use this version instead:
-- CREATE TABLE IF NOT EXISTS embeddings (
--     id BIGSERIAL PRIMARY KEY,
--     document_id BIGINT REFERENCES documents(id) ON DELETE CASCADE,
--     chunk_index INTEGER NOT NULL,
--     chunk_text TEXT NOT NULL,
--     embedding TEXT,
--     created_at TIMESTAMPTZ DEFAULT NOW()
-- );

-- Also disable RLS on shared_documents if not already done:
ALTER TABLE shared_documents DISABLE ROW LEVEL SECURITY;
