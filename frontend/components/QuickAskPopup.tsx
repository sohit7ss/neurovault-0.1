'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';
import { getUserProfile } from '@/lib/userProfile';
import { getPersonaPrompt, PERSONA_LABELS } from '@/lib/personaPrompts';
import { logActivity } from '@/lib/streakTracker';
import { HiOutlineSparkles, HiOutlinePaperAirplane, HiOutlineXMark } from 'react-icons/hi2';

interface QAMessage {
  role: 'user' | 'ai';
  content: string;
}

export default function QuickAskPopup() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<QAMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;

    logActivity('quick_ask');
    setMessages(prev => [...prev, { role: 'user', content: q }]);
    setInput('');
    setLoading(true);

    try {
      const profile = getUserProfile();
      const persona = getPersonaPrompt(profile.persona || 'friendlyGuide');
      const enrichedQuery = `${persona}\n\nUser question: ${q}`;
      const res = await api.queryAI(enrichedQuery);
      let answer = res.answer || 'Sorry, I couldn\'t find an answer.';
      if (answer.length > 600) answer = answer.slice(0, 600) + '...';
      setMessages(prev => [...prev, { role: 'ai', content: answer }]);
    } catch {
      setMessages(prev => [...prev, { role: 'ai', content: '⚠️ Failed to get response. Try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  // Keep only last 6 messages displayed
  const displayed = messages.slice(-6);

  return (
    <>
      {/* Floating Button */}
      <motion.button
        onClick={() => setOpen(!open)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 90,
          width: 56, height: 56, borderRadius: '50%', cursor: 'pointer',
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          border: 'none', boxShadow: '0 4px 24px rgba(99,102,241,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff',
        }}
        title="Quick Ask AI (Ctrl+K)"
      >
        {open ? <HiOutlineXMark size={24} /> : <HiOutlineSparkles size={24} />}
      </motion.button>

      {/* Popup */}
      <AnimatePresence>
        {open && (
          <>
            {/* Overlay */}
            <div onClick={() => setOpen(false)} style={{
              position: 'fixed', inset: 0, zIndex: 91,
              background: 'rgba(0,0,0,0.2)',
            }} />

            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              style={{
                position: 'fixed', bottom: 90, right: 24, zIndex: 92,
                width: 400, height: 500, borderRadius: 16,
                background: 'rgba(15,17,40,0.98)',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                display: 'flex', flexDirection: 'column',
                backdropFilter: 'blur(20px)',
                overflow: 'hidden',
              }}
            >
              {/* Header */}
              <div style={{
                padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <HiOutlineSparkles size={18} style={{ color: '#818cf8' }} />
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Quick Ask AI</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
                    Ctrl+K
                  </span>
                  <button onClick={() => setOpen(false)} style={{
                    background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2,
                  }}><HiOutlineXMark size={16} /></button>
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {displayed.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    Ask any concept and get instant answers without leaving your page.
                  </div>
                )}
                {displayed.map((m, i) => (
                  <div key={i} style={{
                    alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%', padding: '10px 14px', borderRadius: 12,
                    background: m.role === 'user' ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                    border: m.role === 'user' ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(255,255,255,0.06)',
                    fontSize: '0.82rem', lineHeight: 1.6, color: 'var(--text-secondary)',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  }}>
                    {m.content}
                  </div>
                ))}
                {loading && (
                  <div style={{ display: 'flex', gap: 4, padding: '8px 14px' }}>
                    {[0, 1, 2].map(i => (
                      <motion.div key={i} animate={{ y: [0, -4, 0] }}
                        transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.12 }}
                        style={{ width: 5, height: 5, borderRadius: '50%', background: '#818cf8' }} />
                    ))}
                  </div>
                )}
                <div ref={endRef} />
              </div>

              {/* Input */}
              <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 8 }}>
                <input ref={inputRef} type="text" value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send(); } }}
                  placeholder="Ask anything..."
                  disabled={loading}
                  style={{
                    flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)',
                    fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none',
                  }} />
                <button onClick={send} disabled={loading || !input.trim()}
                  style={{
                    width: 36, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: loading || !input.trim() ? 0.4 : 1,
                  }}>
                  <HiOutlinePaperAirplane size={16} style={{ color: '#fff' }} />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
