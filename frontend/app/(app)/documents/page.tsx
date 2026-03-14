'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api, { Document } from '@/lib/api';
import {
  HiOutlineDocumentText, HiOutlineArrowUpTray, HiOutlineTrash,
  HiOutlineXMark, HiOutlineCloudArrowUp,
} from 'react-icons/hi2';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await api.getDocuments(page, 12);
      setDocuments(res.documents);
      setTotal(res.total);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleUpload = async (files: FileList | File[]) => {
    setError('');
    setUploading(true);

    const fileArray = Array.from(files);
    
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      setUploadProgress(`Uploading ${file.name} (${i + 1}/${fileArray.length})...`);
      
      try {
        await api.uploadDocument(file);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : `Failed to upload ${file.name}`);
      }
    }

    setUploading(false);
    setUploadProgress('');
    fetchDocuments();
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
      fetchDocuments();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
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
                  <span style={{
                    fontSize: '0.72rem', padding: '2px 8px', borderRadius: 6,
                    background: doc.status === 'ready' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                    color: doc.status === 'ready' ? '#10b981' : '#f59e0b',
                    fontWeight: 500,
                  }}>
                    {doc.status}
                  </span>
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
    </div>
  );
}
