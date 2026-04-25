'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import 'katex/dist/katex.min.css';
import api from '@/lib/api';
import { HiOutlinePaperAirplane, HiOutlineSparkles, HiOutlineDocumentText, HiOutlineTrash } from 'react-icons/hi2';
import PersonaSelector from '@/components/PersonaSelector';
import { getUserProfile, updateUserProfile } from '@/lib/userProfile';
import { getPersonaPrompt, PERSONA_LABELS } from '@/lib/personaPrompts';
import { logActivity } from '@/lib/streakTracker';

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  sources?: { document_id: number; title: string }[];
  timestamp: Date;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [activePersona, setActivePersona] = useState('friendlyGuide');

  // Load persona from profile on mount
  useEffect(() => {
    logActivity('ai_search');
    const profile = getUserProfile();
    if (profile.persona) setActivePersona(profile.persona);
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle persona change — persist to profile
  const handlePersonaChange = (newPersona: string) => {
    setActivePersona(newPersona);
    updateUserProfile({ persona: newPersona });
  };

  // ──── CORE SEARCH FUNCTION ────
  const handleSearch = async (searchQuery?: string) => {
    const q = (searchQuery || input).trim();
    if (!q || isLoading) return;

    // Log activity for streak
    logActivity('ai_search');

    // Add user message immediately
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: q,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Get persona prompt and prepend to query
      const personaPrompt = getPersonaPrompt(activePersona);
      const enrichedQuery = `${personaPrompt}\n\nUser query: ${q}`;

      // Call the backend AI search endpoint
      const res = await api.queryAI(enrichedQuery);

      // Parse response — handle multiple response shapes
      const answerText = res.answer || "I couldn't find relevant information in your documents.";

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: answerText,
        sources: res.sources,
        timestamp: new Date(),
      }]);
    } catch (err: unknown) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: err instanceof Error
          ? `⚠️ Search failed: ${err.message}. Please check your connection and try again.`
          : '⚠️ Search failed. Please check your connection and try again.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  // Clear conversation
  const clearChat = () => {
    setMessages([]);
    setInput('');
    inputRef.current?.focus();
  };

  const currentPersona = PERSONA_LABELS[activePersona] || PERSONA_LABELS.friendlyGuide;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>

      {/* ── PAGE HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 4 }}>AI Search</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Ask questions about your documents. AI searches only your private knowledge base.
          </p>
        </div>
        <PersonaSelector onChange={handlePersonaChange} />
      </div>

      {/* ── CHAT AREA ── */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* Empty state — show ONLY when no messages */}
        {messages.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', maxWidth: 440 }}>
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
                style={{
                  width: 80, height: 80, borderRadius: 20,
                  background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(139,92,246,0.15))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
                }}>
                <HiOutlineSparkles size={36} style={{ color: 'var(--accent-blue)' }} />
              </motion.div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: 8 }}>Ask your documents</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                AI searches through your uploaded documents to find answers with formulas, code, and structured responses.
              </p>

              {/* Suggestion pills — clicking these NOW fires the search */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 24 }}>
                {[
                  'Summarize my notes',
                  'Explain the key formulas',
                  'Compare the main concepts',
                  'What are the important definitions?',
                ].map((suggestion, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.05 }}
                    onClick={() => handleSearch(suggestion)}
                    style={{
                      padding: '12px 16px', borderRadius: 10,
                      border: '1px solid var(--border-default)',
                      background: 'rgba(255,255,255,0.02)',
                      color: 'var(--text-secondary)', fontSize: '0.85rem',
                      cursor: 'pointer', textAlign: 'left',
                      transition: 'all 0.2s', fontFamily: 'inherit',
                    }}
                    onMouseOver={e => {
                      e.currentTarget.style.background = 'rgba(59,130,246,0.06)';
                      e.currentTarget.style.borderColor = 'rgba(59,130,246,0.2)';
                      e.currentTarget.style.color = '#93c5fd';
                    }}
                    onMouseOut={e => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                      e.currentTarget.style.borderColor = 'var(--border-default)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                  >
                    {suggestion}
                  </motion.button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* ── Messages — show when conversation started ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0' }}>
            <AnimatePresence>
              {messages.map(msg => (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 10 }}>

                  {/* AI avatar */}
                  {msg.role === 'ai' && (
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0, marginTop: 4,
                      background: 'rgba(99,102,241,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <HiOutlineSparkles size={16} style={{ color: '#818cf8' }} />
                    </div>
                  )}

                  {/* Message bubble */}
                  <div style={{
                    maxWidth: '75%', padding: '14px 18px',
                    borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: msg.role === 'user'
                      ? 'linear-gradient(135deg, rgba(79,70,229,0.35), rgba(99,102,241,0.25))'
                      : 'rgba(255,255,255,0.03)',
                    border: msg.role === 'user'
                      ? '1px solid rgba(99,102,241,0.3)'
                      : '1px solid var(--border-subtle)',
                  }}>
                    {msg.role === 'user' ? (
                      <p style={{ fontSize: '0.9rem', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {msg.content}
                      </p>
                    ) : (
                      <div className="markdown-body">
                        <ReactMarkdown
                          remarkPlugins={[remarkMath, remarkGfm]}
                          rehypePlugins={[rehypeKatex]}
                          components={{
                            p: ({ children }) => <p style={{ margin: '0 0 10px', lineHeight: 1.8, fontSize: '0.9rem' }}>{children}</p>,
                            h1: ({ children }) => <h1 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '16px 0 8px', color: 'var(--text-primary)' }}>{children}</h1>,
                            h2: ({ children }) => <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '14px 0 6px', color: 'var(--text-primary)' }}>{children}</h2>,
                            h3: ({ children }) => <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '12px 0 4px', color: 'var(--text-primary)' }}>{children}</h3>,
                            strong: ({ children }) => <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{children}</strong>,
                            em: ({ children }) => <em style={{ color: 'var(--accent-cyan)' }}>{children}</em>,
                            code: ({ children, className }) => {
                              const isBlock = className?.includes('language-');
                              return isBlock ? (
                                <pre style={{
                                  background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-default)',
                                  borderRadius: 10, padding: '14px 18px', overflowX: 'auto', margin: '10px 0',
                                  fontSize: '0.85rem', lineHeight: 1.6,
                                }}>
                                  <code style={{ color: '#e2e8f0' }}>{children}</code>
                                </pre>
                              ) : (
                                <code style={{
                                  background: 'rgba(59,130,246,0.12)', padding: '2px 6px', borderRadius: 4,
                                  fontSize: '0.85rem', color: '#93c5fd',
                                }}>{children}</code>
                              );
                            },
                            ul: ({ children }) => <ul style={{ margin: '8px 0', paddingLeft: 20 }}>{children}</ul>,
                            ol: ({ children }) => <ol style={{ margin: '8px 0', paddingLeft: 20 }}>{children}</ol>,
                            li: ({ children }) => <li style={{ margin: '4px 0', lineHeight: 1.7, fontSize: '0.9rem' }}>{children}</li>,
                            blockquote: ({ children }) => (
                              <blockquote style={{
                                borderLeft: '3px solid var(--accent-blue)', paddingLeft: 14,
                                margin: '10px 0', color: 'var(--text-secondary)', fontStyle: 'italic',
                              }}>{children}</blockquote>
                            ),
                            table: ({ children }) => (
                              <div style={{ overflowX: 'auto', margin: '10px 0' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>{children}</table>
                              </div>
                            ),
                            th: ({ children }) => (
                              <th style={{
                                padding: '8px 12px', borderBottom: '2px solid var(--border-default)',
                                textAlign: 'left', fontWeight: 600, color: 'var(--text-primary)',
                              }}>{children}</th>
                            ),
                            td: ({ children }) => (
                              <td style={{
                                padding: '6px 12px', borderBottom: '1px solid var(--border-subtle)',
                                color: 'var(--text-secondary)',
                              }}>{children}</td>
                            ),
                            hr: () => <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: '12px 0' }} />,
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}

                    {/* Source citations */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500, marginBottom: 6 }}>Sources:</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {msg.sources.map((src, i) => (
                            <span key={i} style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '3px 8px', borderRadius: 6, background: 'rgba(59,130,246,0.08)',
                              fontSize: '0.75rem', color: 'var(--accent-blue)',
                            }}>
                              <HiOutlineDocumentText size={12} />{src.title}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* User avatar */}
                  {msg.role === 'user' && (
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0, marginTop: 4,
                      background: 'rgba(99,102,241,0.25)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.72rem', fontWeight: 700, color: '#c7d2fe',
                    }}>
                      U
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Loading indicator */}
            {isLoading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ display: 'flex', gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(99,102,241,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <HiOutlineSparkles size={16} style={{ color: '#818cf8' }} />
                </div>
                <div style={{
                  padding: '14px 18px', borderRadius: '16px 16px 16px 4px',
                  background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)',
                }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginRight: 8 }}>Thinking</span>
                    {[0, 1, 2].map(i => (
                      <motion.div key={i} animate={{ y: [0, -6, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                        style={{ width: 6, height: 6, borderRadius: '50%', background: '#818cf8' }} />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ── INPUT AREA — PINNED TO BOTTOM ── */}
      <div style={{ padding: '16px 0', borderTop: '1px solid var(--border-subtle)', marginTop: 8 }}>

        {/* Active persona badge + clear chat */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, paddingLeft: 4 }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Active mode:</span>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: currentPersona.color }}>
            {currentPersona.emoji} {currentPersona.label}
          </span>
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              style={{
                marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4,
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'inherit',
                padding: '2px 6px', borderRadius: 4, transition: 'color 0.2s',
              }}
              onMouseOver={e => e.currentTarget.style.color = '#ef4444'}
              onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <HiOutlineTrash size={12} /> Clear chat
            </button>
          )}
        </div>

        {/* Input row */}
        <div style={{
          display: 'flex', gap: 10, alignItems: 'center',
          background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-default)',
          borderRadius: 14, padding: '4px 4px 4px 18px',
        }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your documents..."
            disabled={isLoading}
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: 'var(--text-primary)', fontSize: '0.95rem', fontFamily: 'inherit',
              opacity: isLoading ? 0.5 : 1,
            }}
          />
          <button
            onClick={() => handleSearch()}
            disabled={!input.trim() || isLoading}
            className="btn-gradient"
            style={{
              padding: '10px 14px', borderRadius: 10,
              opacity: !input.trim() || isLoading ? 0.4 : 1,
              cursor: !input.trim() || isLoading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center',
            }}
          >
            <HiOutlinePaperAirplane size={18} />
          </button>
        </div>

        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>
          AI searches only your private documents. Supports markdown, formulas, and code.
        </p>
      </div>
    </div>
  );
}
