'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api, { Workspace, WorkspaceMember, WorkspaceActivity } from '@/lib/api';
import { 
  HiOutlinePlus, HiOutlineUserGroup, HiOutlineEnvelope, HiOutlineTrash, 
  HiOutlinePencilSquare, HiOutlineArrowRightOnRectangle, HiOutlineChatBubbleLeftRight,
  HiOutlinePaperAirplane, HiOutlineSparkles
} from 'react-icons/hi2';

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  
  // Create Form
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [creating, setCreating] = useState(false);
  
  // Selected Workspace
  const [selectedWs, setSelectedWs] = useState<Workspace | null>(null);
  const [activeTab, setActiveTab] = useState<'documents' | 'members' | 'activity' | 'chat' | 'settings'>('documents');
  
  // Details
  const [wsDocs, setWsDocs] = useState<any[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [activities, setActivities] = useState<WorkspaceActivity[]>([]);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  
  // Chat
  const [messages, setMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isAiSearch, setIsAiSearch] = useState(false);
  const [sendingMsg, setSendingMsg] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Invites
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [inviting, setInviting] = useState(false);

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
      selectWorkspace(ws);
    } catch (err) { console.error(err); }
    finally { setCreating(false); }
  };

  const selectWorkspace = async (ws: Workspace) => {
    setSelectedWs(ws);
    setActiveTab('documents');
    loadWorkspaceDetails(ws.id);
  };

  const loadWorkspaceDetails = async (id: number) => {
    try {
      const [docsRes, membersRes, actRes, invRes, chatRes] = await Promise.all([
        api.getWorkspaceDocuments(id).catch(() => ({ documents: [] })),
        api.getWorkspaceMembers(id).catch(() => ({ members: [] })),
        api.getWorkspaceActivity(id).catch(() => ({ activity: [] })),
        api.getPendingInvites(id).catch(() => ({ invites: [] })),
        api.getWorkspaceMessages(id).catch(() => ({ messages: [] }))
      ]);
      setWsDocs(docsRes.documents || []);
      setMembers(membersRes.members || []);
      setActivities(actRes.activity || []);
      setPendingInvites(invRes.invites || []);
      setMessages(chatRes.messages || []);
      scrollToBottom();
    } catch (e) {
      console.error(e);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSendMessage = async () => {
    if (!selectedWs || !chatInput.trim() || sendingMsg) return;
    const text = chatInput.trim();
    setChatInput('');
    setSendingMsg(true);
    
    // Optimistic UI
    const tempHumanMsg = { id: Date.now(), user_id: 'me', message: text, is_ai: false, created_at: new Date().toISOString(), users: { name: 'You' } };
    setMessages(prev => [...prev, tempHumanMsg]);
    scrollToBottom();

    try {
      const res = await api.sendWorkspaceMessage(selectedWs.id, text, isAiSearch);
      
      setMessages(prev => {
        // Replace temp message with real one
        const updated = prev.map(m => m.id === tempHumanMsg.id ? { ...res.message, users: { name: 'You' } } : m);
        if (res.ai_message) {
          updated.push({ ...res.ai_message, users: { name: 'NeuroVault AI' } });
        }
        return updated;
      });
      scrollToBottom();
    } catch (err: any) {
      alert("Failed to send message");
    } finally {
      setSendingMsg(false);
    }
  };

  // --- Workspace Actions ---

  const handleInvite = async () => {
    if (!selectedWs || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      await api.inviteToWorkspace(selectedWs.id, inviteEmail, inviteRole);
      setInviteEmail('');
      alert("Invitation sent!");
      loadWorkspaceDetails(selectedWs.id);
    } catch (err: any) { 
      alert(err.message || "Failed to invite");
    }
    finally { setInviting(false); }
  };

  const handleRoleChange = async (memberId: number, newRole: string) => {
    if (!selectedWs) return;
    try {
      await api.changeMemberRole(selectedWs.id, memberId, newRole);
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
    } catch (err: any) {
      alert(err.message || "Failed to change role");
    }
  };

  const handleRemoveMember = async (memberId: number) => {
    if (!selectedWs) return;
    if (!confirm("Remove this member from the workspace?")) return;
    try {
      await api.removeWorkspaceMember(selectedWs.id, memberId);
      setMembers(prev => prev.filter(m => m.id !== memberId));
    } catch (err: any) {
      alert(err.message || "Failed to remove member");
    }
  };

  const handleLeaveWorkspace = async () => {
    if (!selectedWs) return;
    if (!confirm("Are you sure you want to leave this workspace?")) return;
    try {
      await api.leaveWorkspace(selectedWs.id);
      setSelectedWs(null);
      fetchWorkspaces();
    } catch (err: any) {
      alert(err.message || "Failed to leave workspace");
    }
  };

  const handleSaveDescription = async (newDesc: string) => {
    if (!selectedWs) return;
    try {
      const updated = await api.updateWorkspaceSettings(selectedWs.id, { description: newDesc });
      setSelectedWs(updated);
      setWorkspaces(prev => prev.map(w => w.id === updated.id ? updated : w));
    } catch (err: any) {
      alert("Failed to update: " + err.message);
    }
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
            exit={{ opacity: 0, height: 0 }} className="glass-card" style={{ padding: 24, marginBottom: 24, overflow: 'hidden' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: 16 }}>Create Workspace</h3>
            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Workspace name"
                className="glass-input" style={{ flex: 1 }} />
              <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (optional)"
                className="glass-input" style={{ flex: 2 }} />
            </div>
            <button onClick={handleCreate} disabled={creating || !name.trim()} className="btn-gradient"
              style={{ padding: '10px 24px' }}>
              {creating ? 'Creating...' : 'Create Workspace'}
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
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 300px) 1fr', gap: 24, alignItems: 'start' }}>
          {/* Workspace List Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ marginBottom: 8, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Your Workspaces
            </div>
            {workspaces.map(ws => (
              <button key={ws.id} onClick={() => selectWorkspace(ws)} style={{
                padding: '16px', borderRadius: 12, textAlign: 'left', cursor: 'pointer',
                background: selectedWs?.id === ws.id ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${selectedWs?.id === ws.id ? 'rgba(59,130,246,0.3)' : 'var(--border-subtle)'}`,
                color: 'inherit', fontFamily: 'inherit', transition: 'all 0.2s', position: 'relative', overflow: 'hidden'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <div style={{ 
                    width: 14, height: 14, borderRadius: '4px', 
                    background: ws.color || '#3b82f6',
                    boxShadow: `0 0 10px ${ws.color || '#3b82f6'}80`
                  }} />
                  <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>{ws.name}</div>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                  <span><HiOutlineUserGroup style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }}/>{ws.member_count}</span>
                  <span style={{ textTransform: 'uppercase', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4, fontSize: '0.7rem' }}>
                    {ws.role}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Workspace Detail Panel */}
          {selectedWs && (
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden', minHeight: 600, display: 'flex', flexDirection: 'column' }}>
              
              {/* Header */}
              <div style={{ padding: 24, paddingBottom: 0, borderBottom: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 16, height: 16, borderRadius: '4px', background: selectedWs.color || '#3b82f6', boxShadow: `0 0 16px ${selectedWs.color || '#3b82f6'}aa` }} />
                      {selectedWs.name}
                    </h2>
                    
                    {/* Inline Editable Description */}
                    {selectedWs.role === 'owner' ? (
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                        <input 
                          type="text" 
                          defaultValue={selectedWs.description || ''} 
                          onBlur={(e) => {
                            if (e.target.value !== selectedWs.description) handleSaveDescription(e.target.value);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.currentTarget.blur();
                          }}
                          className="glass-input"
                          style={{ fontSize: '0.85rem', padding: '6px 10px', width: '100%', maxWidth: '400px', background: 'transparent', border: '1px dashed transparent', transition: 'all 0.2s', color: 'var(--text-secondary)' }}
                          placeholder="Add a description... (Click to edit)"
                          onFocus={(e) => e.target.style.border = '1px dashed var(--border-subtle)'}
                        />
                        <HiOutlinePencilSquare style={{ position: 'absolute', right: -20, opacity: 0.5, pointerEvents: 'none' }} />
                      </div>
                    ) : (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', padding: '6px 10px', marginBottom: 12 }}>
                        {selectedWs.description || 'No description provided.'}
                      </p>
                    )}
                  </div>
                  
                  <button onClick={handleLeaveWorkspace} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', padding: '8px 16px' }}>
                    <HiOutlineArrowRightOnRectangle size={16} /> Leave
                  </button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 24, marginTop: 12 }}>
                  {['documents', 'chat', 'members', 'activity', 'settings'].map(tab => (
                    <button key={tab} onClick={() => { setActiveTab(tab as any); if (tab === 'chat') scrollToBottom(); }} style={{
                      padding: '12px 4px', background: 'none', border: 'none', color: activeTab === tab ? '#fff' : 'var(--text-muted)',
                      borderBottom: `2px solid ${activeTab === tab ? '#3b82f6' : 'transparent'}`,
                      fontWeight: activeTab === tab ? 600 : 400, cursor: 'pointer', textTransform: 'capitalize', fontSize: '0.9rem',
                      display: 'flex', alignItems: 'center', gap: 8
                    }}>
                      {tab === 'chat' && <HiOutlineChatBubbleLeftRight />}
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Content */}
              <div style={{ padding: activeTab === 'chat' ? 0 : 24, flex: 1, display: 'flex', flexDirection: 'column' }}>
                
                {/* DOCUMENTS TAB */}
                {activeTab === 'documents' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>Shared Documents</h3>
                    </div>
                    {wsDocs.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: 20, textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
                        No documents shared yet. Go to your Documents to share them here.
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {wsDocs.map(doc => (
                          <div key={doc.id} style={{
                            padding: '12px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', 
                            border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                          }}>
                            <div>
                              <div style={{ fontSize: '0.9rem', fontWeight: 500, color: '#fff' }}>{doc.title}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Shared by {doc.shared_by} • <span style={{ textTransform: 'capitalize' }}>{doc.permission_level}</span></div>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {new Date(doc.shared_at).toLocaleDateString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* CHAT TAB */}
                {activeTab === 'chat' && (
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    
                    {/* Messages Area */}
                    <div style={{ flex: 1, padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, minHeight: 400 }}>
                      {messages.length === 0 ? (
                        <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', maxWidth: 300 }}>
                          <HiOutlineChatBubbleLeftRight size={48} style={{ opacity: 0.2, margin: '0 auto 16px' }} />
                          <p style={{ fontSize: '0.9rem' }}>Welcome to external chat!<br/>Discuss shared documents or use NeuroVault AI to extract insights.</p>
                        </div>
                      ) : (
                        messages.map((msg, i) => {
                          const isAi = msg.is_ai;
                          const isMe = msg.users?.name === 'You';
                          return (
                            <div key={msg.id || i} style={{
                              alignSelf: isMe ? 'flex-end' : 'flex-start',
                              maxWidth: '80%', display: 'flex', flexDirection: 'column',
                              alignItems: isMe ? 'flex-end' : 'flex-start'
                            }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4, marginLeft: 4, marginRight: 4 }}>
                                {isAi ? <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}><HiOutlineSparkles size={12}/> AI response</span> : msg.users?.name || 'Unknown'}
                              </span>
                              <div style={{
                                padding: '10px 14px', borderRadius: 12, fontSize: '0.9rem', lineHeight: '1.4',
                                background: isAi ? 'rgba(16,185,129,0.1)' : isMe ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)',
                                border: `1px solid ${isAi ? 'rgba(16,185,129,0.2)' : isMe ? 'rgba(59,130,246,0.3)' : 'var(--border-subtle)'}`,
                                color: '#eee', whiteSpace: 'pre-wrap'
                              }}>
                                {msg.message}
                              </div>
                            </div>
                          );
                        })
                      )}
                      
                      {sendingMsg && (
                        <div style={{ alignSelf: 'flex-start', padding: '10px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          <span style={{ display: 'inline-block', animation: 'pulse 1.5s infinite' }}>●</span>
                          <span style={{ display: 'inline-block', animation: 'pulse 1.5s infinite', animationDelay: '0.2s', margin: '0 2px' }}>●</span>
                          <span style={{ display: 'inline-block', animation: 'pulse 1.5s infinite', animationDelay: '0.4s' }}>●</span>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div style={{ padding: 16, borderTop: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.3)' }}>
                      
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, padding: '0 8px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.8rem', color: isAiSearch ? '#10b981' : 'var(--text-muted)', transition: 'color 0.2s' }}>
                          <input 
                            type="checkbox" 
                            checked={isAiSearch} 
                            onChange={e => setIsAiSearch(e.target.checked)} 
                            style={{ accentColor: '#10b981', width: 14, height: 14 }}
                          />
                          <HiOutlineSparkles /> Ask NeuroVault AI
                        </label>
                      </div>

                      <div style={{ display: 'flex', gap: 10 }}>
                        <input 
                          value={chatInput} 
                          onChange={e => setChatInput(e.target.value)} 
                          onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                          placeholder={isAiSearch ? "Ask AI about workspace documents..." : "Type a message..."} 
                          className="glass-input" 
                          style={{ flex: 1, padding: '12px 16px', borderRadius: 24 }} 
                        />
                        <button 
                          onClick={handleSendMessage} 
                          disabled={sendingMsg || !chatInput.trim()} 
                          className="btn-gradient" 
                          style={{ width: 44, height: 44, borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <HiOutlinePaperAirplane size={18} style={{ transform: 'rotate(45deg) translateX(-2px)' }} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* MEMBERS TAB */}
                {activeTab === 'members' && (
                  <div>
                    {/* Invite Section (Owners/Editors) */}
                    {['owner', 'editor'].includes(selectedWs.role || '') && (
                      <div style={{ marginBottom: 24, padding: 16, background: 'rgba(59,130,246,0.05)', borderRadius: 12, border: '1px solid rgba(59,130,246,0.1)' }}>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 12 }}>Invite new member</h4>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <div style={{ position: 'relative', flex: 1 }}>
                            <HiOutlineEnvelope style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="Email address" className="glass-input" style={{ paddingLeft: 36, width: '100%' }} />
                          </div>
                          <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} className="glass-input" style={{ width: 120 }}>
                            <option value="viewer">Viewer</option>
                            <option value="editor">Editor</option>
                          </select>
                          <button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()} className="btn-gradient" style={{ padding: '0 20px', whiteSpace: 'nowrap' }}>
                            {inviting ? '...' : 'Invite'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Members Table */}
                    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <thead style={{ background: 'rgba(255,255,255,0.05)', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
                          <tr>
                            <th style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--text-secondary)' }}>User</th>
                            <th style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--text-secondary)' }}>Role</th>
                            <th style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--text-secondary)' }}>Joined</th>
                            <th style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--text-secondary)' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {members.map(member => (
                            <tr key={member.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <td style={{ padding: '12px 16px' }}>
                                <div style={{ fontWeight: 500, color: '#fff' }}>{member.name}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{member.email}</div>
                              </td>
                              <td style={{ padding: '12px 16px' }}>
                                {selectedWs.role === 'owner' && member.role !== 'owner' ? (
                                  <select 
                                    value={member.role} 
                                    onChange={(e) => handleRoleChange(member.id, e.target.value)}
                                    className="glass-input" 
                                    style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                                  >
                                    <option value="viewer">Viewer</option>
                                    <option value="editor">Editor</option>
                                    <option value="owner">Owner</option>
                                  </select>
                                ) : (
                                  <span style={{ 
                                    padding: '4px 10px', borderRadius: 4, fontSize: '0.8rem', fontWeight: 500, textTransform: 'uppercase',
                                    background: member.role === 'owner' ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.05)',
                                    color: member.role === 'owner' ? '#60a5fa' : 'var(--text-muted)'
                                  }}>
                                    {member.role}
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                                {member.joined_at ? new Date(member.joined_at).toLocaleDateString() : 'N/A'}
                              </td>
                              <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                {selectedWs.role === 'owner' && member.role !== 'owner' && (
                                  <button onClick={() => handleRemoveMember(member.id)} title="Remove Member"
                                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4, opacity: 0.7 }}
                                    onMouseOver={e => e.currentTarget.style.opacity = '1'}
                                    onMouseOut={e => e.currentTarget.style.opacity = '0.7'}
                                  >
                                    <HiOutlineTrash size={18} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pending Invites */}
                    {['owner', 'editor'].includes(selectedWs.role || '') && pendingInvites.length > 0 && (
                      <div style={{ marginTop: 24 }}>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 12 }}>Pending Invites</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {pendingInvites.map(inv => (
                            <div key={inv.id} style={{
                              padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.02)',
                              border: '1px dashed var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}>
                              <div>
                                <span style={{ fontSize: '0.9rem', color: '#fff', marginRight: 12 }}>{inv.email}</span>
                                <span style={{ fontSize: '0.75rem', padding: '2px 6px', background: 'rgba(255,255,255,0.1)', borderRadius: 4, textTransform: 'uppercase' }}>{inv.role}</span>
                              </div>
                              <button onClick={() => api.request(`/workspaces/${selectedWs.id}/invites/${inv.id}`, { method: 'DELETE' }).then(() => loadWorkspaceDetails(selectedWs.id))}
                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem' }}>
                                Cancel Invite
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ACTIVITY TAB */}
                {activeTab === 'activity' && (
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: 16 }}>Workspace Activity Feed</h3>
                    {activities.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)' }}>No recent activity.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {activities.map(act => (
                          <div key={act.id} style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{act.users?.name || 'Unknown User'}</span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(act.created_at).toLocaleString()}</span>
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                              Action: <strong style={{ textTransform: 'uppercase' }}>{act.action.replace('_', ' ')}</strong>
                              {Object.keys(act.metadata || {}).length > 0 && (
                                <pre style={{ marginTop: 8, padding: 8, background: 'rgba(0,0,0,0.2)', borderRadius: 4, fontSize: '0.75rem', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                                  {JSON.stringify(act.metadata, null, 2)}
                                </pre>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* SETTINGS TAB */}
                {activeTab === 'settings' && (
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: 16 }}>Workspace Settings</h3>
                    {selectedWs.role === 'owner' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 6 }}>Workspace Name</label>
                          <input type="text" defaultValue={selectedWs.name} className="glass-input" style={{ width: '100%', maxWidth: 400 }} 
                            onBlur={(e) => { if (e.target.value !== selectedWs.name) api.updateWorkspaceSettings(selectedWs.id, { name: e.target.value }).then(fetchWorkspaces) }} 
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 6 }}>Theme Color</label>
                          <div style={{ display: 'flex', gap: 12 }}>
                            {['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#ef4444'].map(color => (
                              <button key={color} onClick={() => {
                                api.updateWorkspaceSettings(selectedWs.id, { color }).then(updated => {
                                  setSelectedWs(updated);
                                  setWorkspaces(prev => prev.map(w => w.id === updated.id ? updated : w));
                                })
                              }} style={{ 
                                width: 32, height: 32, borderRadius: '50%', background: color, border: 'none', cursor: 'pointer',
                                outline: selectedWs.color === color ? '2px solid #fff' : 'none', outlineOffset: 2
                              }} />
                            ))}
                          </div>
                        </div>
                        <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--border-subtle)' }}>
                          <h4 style={{ color: '#ef4444', marginBottom: 8 }}>Danger Zone</h4>
                          <button onClick={handleLeaveWorkspace} className="btn-secondary" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                            Delete Workspace
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p style={{ color: 'var(--text-muted)' }}>Only the workspace owner can modify these settings.</p>
                    )}
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
