'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api, { Document, Workspace } from '@/lib/api';
import { createCard } from '@/lib/flashcardStore';
import { logActivity } from '@/lib/streakTracker';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import {
  HiOutlineDocumentText, HiOutlineArrowUpTray, HiOutlineTrash,
  HiOutlineXMark, HiOutlineCloudArrowUp, HiOutlineShare, HiOutlineSparkles,
  HiOutlineNewspaper,
} from 'react-icons/hi2';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  // Share Modal State
  const [shareDocId, setShareDocId] = useState<number | null>(null);
  const [shareWsId, setShareWsId] = useState<number>(0);
  const [shareSharing, setShareSharing] = useState(false);

  // Flashcard generation
  const [generatingFlashcards, setGeneratingFlashcards] = useState<number | null>(null);

  // Summary
  const [summarizingId, setSummarizingId] = useState<number | null>(null);
  const [summaryContent, setSummaryContent] = useState('');
  const [summaryTitle, setSummaryTitle] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const [flashcardSuccess, setFlashcardSuccess] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [docRes, wsRes] = await Promise.all([
        api.getDocuments(page, 12),
        api.getWorkspaces()
      ]);
      setDocuments(docRes.documents);
      setTotal(docRes.total);
      setWorkspaces(wsRes.workspaces);
      if (wsRes.workspaces.length > 0) setShareWsId(wsRes.workspaces[0].id);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    logActivity('documents_visit');
    fetchData();
  }, [fetchData]);

  const handleGenerateFlashcards = async (doc: Document) => {
    setGeneratingFlashcards(doc.id);
    try {
      const prompt = `Extract 10 flashcard pairs from this document titled "${doc.title}". Return ONLY a valid JSON array: [{"front": "question or term", "back": "answer or definition"}]. Content context: ${doc.title}, filename: ${doc.filename}.`;
      const res = await api.queryAI(prompt);
      let parsed: { front: string; back: string }[] = [];
      try {
        const match = res.answer.match(/\[[\s\S]*\]/);
        if (match) parsed = JSON.parse(match[0]);
      } catch { /* ignore parse errors */ }
      if (parsed.length > 0) {
        parsed.forEach(p => {
          createCard({ front: p.front, back: p.back, deckName: doc.title, source: doc.title });
        });
        logActivity('flashcard_generate');
        setFlashcardSuccess(doc.id);
        setTimeout(() => setFlashcardSuccess(null), 3000);
      }
    } catch (err) {
      console.error('Flashcard generation failed:', err);
    } finally {
      setGeneratingFlashcards(null);
    }
  };

  const handleUpload = async (files: FileList | File[]) => {
    setError('');
    setUploading(true);

    const fileArray = Array.from(files);
    
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      setUploadProgress(`Uploading ${file.name} (${i + 1}/${fileArray.length})...`);
      
      try {
        await api.uploadDocument(file);
      } catch (err: any) {
        setError(err.message || `Failed to upload ${file.name}`);
      }
    }

    setUploading(false);
    setUploadProgress('');
    fetchData();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this document? This will also remove its embeddings.')) return;
    try {
      await api.deleteDocument(id);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete');
    }
  };

  const handleShare = async () => {
    if (!shareDocId || !shareWsId) return;
    setShareSharing(true);
    try {
      await api.shareToWorkspace(shareWsId, shareDocId);
      alert('Document successfully shared to workspace!');
      setShareDocId(null);
    } catch (err: any) {
      alert(err.message || 'Failed to share document');
    } finally {
      setShareSharing(false);
    }
  };

  const getFileIcon = (mime: string) => {
    if (mime?.includes('pdf')) return '📄';
    if (mime?.includes('word')) return '📝';
    if (mime?.includes('markdown')) return '📋';
    return '📃';
  };

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 4 }}>Documents</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Upload and manage your knowledge base. {total > 0 && `${total} documents stored.`}
        </p>
      </div>

      {/* Upload Zone */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragActive ? 'var(--accent-blue)' : 'var(--border-default)'}`,
          borderRadius: 16, padding: '40px 20px',
          textAlign: 'center', marginBottom: 32,
          background: dragActive ? 'rgba(59,130,246,0.05)' : 'transparent',
          transition: 'all 0.3s',
          cursor: 'pointer',
        }}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <input
          id="file-input"
          type="file"
          multiple
          accept=".pdf,.docx,.txt,.md"
          style={{ display: 'none' }}
          onChange={(e) => e.target.files && handleUpload(e.target.files)}
        />
        
        {uploading ? (
          <div>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              style={{
                width: 48, height: 48, margin: '0 auto 16px',
                border: '3px solid rgba(59,130,246,0.2)', borderTopColor: '#3b82f6',
                borderRadius: '50%',
              }}
            />
            <p style={{ color: 'var(--accent-blue)', fontWeight: 500 }}>{uploadProgress}</p>
          </div>
        ) : (
          <>
            <HiOutlineCloudArrowUp size={40} style={{
              color: dragActive ? 'var(--accent-blue)' : 'var(--text-muted)',
              marginBottom: 16,
            }} />
            <p style={{ fontWeight: 500, marginBottom: 4 }}>
              {dragActive ? 'Drop files here' : 'Drag & drop files here'}
            </p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              or click to browse • PDF, DOCX, TXT, MD up to 10MB
            </p>
          </>
        )}
      </motion.div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: 10, padding: '10px 14px', marginBottom: 20,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}
          >
            <span style={{ color: '#fca5a5', fontSize: '0.85rem' }}>{error}</span>
            <button onClick={() => setError('')} style={{
              background: 'none', border: 'none', cursor: 'pointer', color: '#fca5a5',
            }}>
              <HiOutlineXMark size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Documents Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          Loading documents...
        </div>
      ) : documents.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 60, color: 'var(--text-muted)',
        }}>
          <HiOutlineDocumentText size={60} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
          <p style={{ fontSize: '1.1rem', fontWeight: 500, marginBottom: 4 }}>No documents yet</p>
          <p style={{ fontSize: '0.9rem' }}>Upload your first document to start building your AI knowledge base</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {documents.map((doc, i) => (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card"
              style={{ padding: 20, position: 'relative', cursor: 'default' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{
                  fontSize: '1.5rem', width: 44, height: 44, borderRadius: 10,
                  background: 'rgba(59,130,246,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {getFileIcon(doc.mime_type)}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h3 style={{
                    fontSize: '0.95rem', fontWeight: 600, marginBottom: 4,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {doc.title}
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {doc.filename}
                  </p>
                </div>
              </div>

              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border-subtle)',
              }}>
                <div style={{ display: 'flex', gap: 12, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  <span>{(doc.file_size / 1024).toFixed(1)} KB</span>
                  <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={() => handleGenerateFlashcards(doc)}
                    disabled={generatingFlashcards === doc.id}
                    style={{
                      background: flashcardSuccess === doc.id ? 'rgba(16,185,129,0.1)' : 'rgba(139,92,246,0.08)',
                      border: `1px solid ${flashcardSuccess === doc.id ? 'rgba(16,185,129,0.2)' : 'rgba(139,92,246,0.15)'}`,
                      borderRadius: 6, padding: '4px 8px', cursor: generatingFlashcards === doc.id ? 'wait' : 'pointer',
                      color: flashcardSuccess === doc.id ? '#10b981' : '#8b5cf6',
                      fontFamily: 'inherit', fontSize: '0.72rem', fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: 4,
                      transition: 'all 0.2s',
                    }}
                    title="Generate Flashcards"
                  >
                    <HiOutlineSparkles size={13} />
                    {generatingFlashcards === doc.id ? 'Generating...' : flashcardSuccess === doc.id ? '✓ Done' : 'Flashcards'}
                  </button>
                  <button
                    onClick={async () => {
                      setSummarizingId(doc.id);
                      try {
                        const res = await api.queryAI(`Provide a concise yet thorough summary of the document titled "${doc.title}". Include key points, main ideas, and important details. Use bullet points and headers.`);
                        setSummaryContent(res.answer || 'Could not generate summary.');
                        setSummaryTitle(doc.title);
                        setShowSummary(true);
                      } catch { setSummaryContent('Failed to summarize.'); setShowSummary(true); setSummaryTitle(doc.title); }
                      finally { setSummarizingId(null); }
                    }}
                    disabled={summarizingId === doc.id}
                    style={{
                      background: 'rgba(59,130,246,0.08)',
                      border: '1px solid rgba(59,130,246,0.15)',
                      borderRadius: 6, padding: '4px 8px', cursor: summarizingId === doc.id ? 'wait' : 'pointer',
                      color: '#3b82f6', fontFamily: 'inherit', fontSize: '0.72rem', fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.2s',
                    }}
                    title="Summarize Document"
                  >
                    <HiOutlineNewspaper size={13} />
                    {summarizingId === doc.id ? '...' : 'Summary'}
                  </button>
                  <button
                    onClick={() => setShareDocId(doc.id)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: 4, borderRadius: 6, color: '#3b82f6',
                      transition: 'opacity 0.2s', opacity: 0.8
                    }}
                    title="Share to Workspace"
                    onMouseOver={e => e.currentTarget.style.opacity = '1'}
                    onMouseOut={e => e.currentTarget.style.opacity = '0.8'}
                  >
                    <HiOutlineShare size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: 4, borderRadius: 6, color: 'var(--text-muted)',
                      transition: 'color 0.2s',
                    }}
                    title="Delete document"
                  >
                    <HiOutlineTrash size={16} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Share Modal */}
      <AnimatePresence>
        {shareDocId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
            }}
            onClick={() => setShareDocId(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card"
              style={{ padding: 32, width: '100%', maxWidth: 400 }}
              onClick={e => e.stopPropagation()}
            >
              <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: 8 }}>Share to Workspace</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 24 }}>
                Select a workspace to share this document with.
              </p>
              
              {workspaces.length === 0 ? (
                <p style={{ color: '#ef4444', fontSize: '0.9rem' }}>You are not a member of any workspaces.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <select 
                    value={shareWsId} 
                    onChange={e => setShareWsId(Number(e.target.value))}
                    className="glass-input"
                    style={{ width: '100%', padding: '10px' }}
                  >
                    {workspaces.map(ws => (
                      <option key={ws.id} value={ws.id}>{ws.name}</option>
                    ))}
                  </select>
                  
                  <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                    <button style={{ flex: 1, padding: '10px' }} className="btn-secondary" onClick={() => setShareDocId(null)}>
                      Cancel
                    </button>
                    <button style={{ flex: 1, padding: '10px' }} className="btn-gradient" onClick={handleShare} disabled={shareSharing}>
                      {shareSharing ? 'Sharing...' : 'Share Document'}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pagination */}
      {total > 12 && (
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 8, marginTop: 32,
        }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-gradient"
            style={{ padding: '8px 16px', fontSize: '0.85rem', opacity: page === 1 ? 0.5 : 1 }}
          >
            Previous
          </button>
          <span style={{
            padding: '8px 16px', fontSize: '0.85rem', color: 'var(--text-secondary)',
            display: 'flex', alignItems: 'center',
          }}>
            Page {page}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={documents.length < 12}
            className="btn-gradient"
            style={{ padding: '8px 16px', fontSize: '0.85rem', opacity: documents.length < 12 ? 0.5 : 1 }}
          >
            Next
          </button>
        </div>
      )}
      {/* Summary Modal */}
      <AnimatePresence>
        {showSummary && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
            }}
            onClick={() => setShowSummary(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card"
              style={{ padding: 32, width: '100%', maxWidth: 640, maxHeight: '80vh', overflow: 'auto' }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <HiOutlineNewspaper size={20} style={{ color: '#3b82f6' }} /> AI Summary
                </h2>
                <button onClick={() => setShowSummary(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                  <HiOutlineXMark size={20} />
                </button>
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                {summaryTitle}
              </div>
              <div style={{ lineHeight: 1.7 }}>
                <MarkdownRenderer content={summaryContent} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
