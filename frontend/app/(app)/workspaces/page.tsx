'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api, { Workspace } from '@/lib/api';
import { HiOutlinePlus, HiOutlineUserGroup, HiOutlineEnvelope } from 'react-icons/hi2';

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedWs, setSelectedWs] = useState<Workspace | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [inviting, setInviting] = useState(false);
  const [wsDocs, setWsDocs] = useState<{ id: number; title: string; shared_at: string }[]>([]);

  const fetchWorkspaces = async () => {
    try {
      const res = await api.getWorkspaces();
      setWorkspaces(res.workspaces);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchWorkspaces(); }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const ws = await api.createWorkspace(name, desc);
      setWorkspaces(prev => [ws, ...prev]);
      setShowCreate(false); setName(''); setDesc('');
      setSelectedWs(ws);
    } catch (err) { console.error(err); }
    finally { setCreating(false); }
  };

  const handleInvite = async () => {
    if (!selectedWs || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      await api.inviteToWorkspace(selectedWs.id, inviteEmail, inviteRole);
      setInviteEmail('');
      fetchWorkspaces();
    } catch (err) { console.error(err); }
    finally { setInviting(false); }
  };

  const loadWsDocs = async (ws: Workspace) => {
    setSelectedWs(ws);
    try {
      const res = await api.getWorkspaceDocuments(ws.id);
      setWsDocs(res.documents);
    } catch { setWsDocs([]); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 4 }}>Workspaces</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Collaborate with your team — share documents and knowledge
          </p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-gradient"
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px' }}>
          <HiOutlinePlus size={18} /> New Workspace
        </button>
      </div>

      {/* Create Form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: 16 }}>Create Workspace</h3>
            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Workspace name"
                className="glass-input" style={{ flex: 1 }} />
              <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (optional)"
                className="glass-input" style={{ flex: 2 }} />
            </div>
            <button onClick={handleCreate} disabled={creating || !name.trim()} className="btn-gradient"
              style={{ padding: '10px 24px' }}>
              {creating ? 'Creating...' : 'Create'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Loading...</div>
      ) : workspaces.length === 0 && !showCreate ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <HiOutlineUserGroup size={60} style={{ margin: '0 auto 16px', opacity: 0.2, color: 'var(--text-muted)' }} />
          <p style={{ fontSize: '1.1rem', fontWeight: 500, color: 'var(--text-muted)' }}>No workspaces yet</p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Create a workspace to start collaborating
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24 }}>
          {/* Workspace List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {workspaces.map(ws => (
              <button key={ws.id} onClick={() => loadWsDocs(ws)} style={{
                padding: '16px', borderRadius: 12, textAlign: 'left', cursor: 'pointer',
                background: selectedWs?.id === ws.id ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${selectedWs?.id === ws.id ? 'rgba(59,130,246,0.3)' : 'var(--border-subtle)'}`,
                color: 'inherit', fontFamily: 'inherit', transition: 'all 0.2s',
              }}>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 4 }}>{ws.name}</div>
                {ws.description && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6 }}>{ws.description}</div>}
                <div style={{ display: 'flex', gap: 12, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span>👥 {ws.member_count} members</span>
                  <span>{new Date(ws.created_at).toLocaleDateString()}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Workspace Detail */}
          {selectedWs && (
            <div>
              <div className="glass-card" style={{ padding: 24, marginBottom: 16 }}>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 4 }}>{selectedWs.name}</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {selectedWs.description || 'No description'}
                </p>
              </div>

              {/* Invite */}
              <div className="glass-card" style={{ padding: 20, marginBottom: 16 }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 12 }}>Invite Member</h3>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <HiOutlineEnvelope style={{
                      position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                      color: 'var(--text-muted)',
                    }} />
                    <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                      placeholder="Email address" className="glass-input" style={{ paddingLeft: 36 }} />
                  </div>
                  <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                    className="glass-input" style={{ width: 120 }}>
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                  </select>
                  <button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}
                    className="btn-gradient" style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                    {inviting ? '...' : 'Invite'}
                  </button>
                </div>
              </div>

              {/* Shared Docs */}
              <div className="glass-card" style={{ padding: 20 }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 12 }}>Shared Documents</h3>
                {wsDocs.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: 20 }}>
                    No documents shared yet. Share from Documents page.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {wsDocs.map(doc => (
                      <div key={doc.id} style={{
                        padding: '10px 14px', borderRadius: 8,
                        background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)',
                        display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem',
                      }}>
                        <span>{doc.title}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                          {new Date(doc.shared_at).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
