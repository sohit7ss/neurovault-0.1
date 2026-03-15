-- ============================================
-- Missing tables for Workspace Enhancements
-- Run this in your Supabase SQL Editor
-- ============================================

-- Workspaces table updates
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS color VARCHAR(20) DEFAULT '#3b82f6';
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS icon VARCHAR(50) DEFAULT 'folder';

-- Workspace Members
-- If the table exists but lacks 'role', this will add it
ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'viewer';

-- Workspace Invites
CREATE TABLE IF NOT EXISTS workspace_invites (
    id BIGSERIAL PRIMARY KEY,
    workspace_id BIGINT REFERENCES workspaces(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'viewer',
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, email)
);

-- Workspace Documents (replacement/enhancement for shared_documents)
CREATE TABLE IF NOT EXISTS workspace_documents (
    id BIGSERIAL PRIMARY KEY,
    workspace_id BIGINT REFERENCES workspaces(id) ON DELETE CASCADE,
    document_id BIGINT REFERENCES documents(id) ON DELETE CASCADE,
    shared_by BIGINT REFERENCES users(id) ON DELETE CASCADE,
    permission_level VARCHAR(50) DEFAULT 'viewer',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, document_id)
);

-- Workspace Activity
CREATE TABLE IF NOT EXISTS workspace_activity (
    id BIGSERIAL PRIMARY KEY,
    workspace_id BIGINT REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workspace AI Chat
CREATE TABLE IF NOT EXISTS workspace_chat (
    id BIGSERIAL PRIMARY KEY,
    workspace_id BIGINT REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    is_ai BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disable RLS on new tables to prevent permission issues
ALTER TABLE workspace_invites DISABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_activity DISABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_chat DISABLE ROW LEVEL SECURITY;
