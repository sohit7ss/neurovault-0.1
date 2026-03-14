'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import 'katex/dist/katex.min.css';
import api from '@/lib/api';
import { HiOutlinePaperAirplane, HiOutlineSparkles, HiOutlineDocumentText } from 'react-icons/hi2';

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg: Message = {
      id: Date.now().toString(), role: 'user', content: input.trim(), timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    const query = input.trim();
    setInput('');
    setIsLoading(true);
    try {
      const res = await api.queryAI(query);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(), role: 'ai', content: res.answer,
        sources: res.sources, timestamp: new Date(),
      }]);
    } catch (err: unknown) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(), role: 'ai',
        content: err instanceof Error ? err.message : 'Error getting response',
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 4 }}>AI Search</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Ask questions about your documents. AI searches only your private knowledge base.
        </p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {messages.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', maxWidth: 400 }}>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 24 }}>
                {['Summarize my notes', 'Explain the key formulas', 'Compare the main concepts', 'What are the important definitions?'].map((s, i) => (
                  <button key={i} onClick={() => { setInput(s); inputRef.current?.focus(); }}
                    style={{
                      padding: '10px 16px', borderRadius: 10, border: '1px solid var(--border-default)',
                      background: 'rgba(255,255,255,0.02)', color: 'var(--text-secondary)',
                      fontSize: '0.85rem', cursor: 'pointer', textAlign: 'left',
                      transition: 'all 0.2s',
                    }}>{s}</button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0' }}>
            <AnimatePresence>
              {messages.map(msg => (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div className={msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}
                    style={{ maxWidth: '80%', padding: '14px 18px' }}>
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
                </motion.div>
              ))}
            </AnimatePresence>
            {isLoading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex' }}>
                <div className="chat-bubble-ai" style={{ padding: '14px 18px' }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <HiOutlineSparkles size={14} style={{ color: 'var(--accent-blue)' }} />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginRight: 8 }}>Thinking</span>
                    {[0, 1, 2].map(i => (
                      <motion.div key={i} animate={{ y: [0, -6, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                        style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-blue)' }} />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div style={{ padding: '16px 0', borderTop: '1px solid var(--border-subtle)', marginTop: 8 }}>
        <div style={{
          display: 'flex', gap: 10, alignItems: 'center',
          background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-default)',
          borderRadius: 14, padding: '4px 4px 4px 18px',
        }}>
          <input ref={inputRef} type="text" value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Ask about your documents..." disabled={isLoading}
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none',
              color: 'var(--text-primary)', fontSize: '0.95rem', fontFamily: 'inherit' }} />
          <button onClick={sendMessage} disabled={!input.trim() || isLoading} className="btn-gradient"
            style={{ padding: '10px 14px', borderRadius: 10, opacity: !input.trim() || isLoading ? 0.5 : 1,
              cursor: !input.trim() || isLoading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center' }}>
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
