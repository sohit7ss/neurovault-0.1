'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api, { Document, Roadmap } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  HiOutlineDocumentText, HiOutlineChatBubbleLeftRight,
  HiOutlineMap, HiOutlineSparkles, HiOutlineArrowUpTray,
  HiOutlineAcademicCap, HiOutlineClock, HiOutlineChartBar,
  HiOutlinePlay
} from 'react-icons/hi2';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [docCount, setDocCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [quickQuery, setQuickQuery] = useState('');

  // Derived Analytics
  const [topicsCompleted, setTopicsCompleted] = useState(0);
  const [hoursLogged, setHoursLogged] = useState(0);

  useEffect(() => {
    async function fetchData() {
      try {
        const [docsRes, roadmapRes] = await Promise.all([
          api.getDocuments(1, 5),
          api.getRoadmaps(),
        ]);
        setDocuments(docsRes.documents);
        setDocCount(docsRes.total);
        setRoadmaps(roadmapRes.roadmaps);

        // Calculate advanced analytics
        let tCompleted = 0;
        let hLogged = 0;
        roadmapRes.roadmaps.forEach(rm => {
          rm.roadmap_data.phases?.forEach(phase => {
            phase.topics?.forEach(top => {
              if (top.completed) {
                tCompleted++;
                hLogged += (top.estimated_hours || 5); // default 5 if undefined
              }
            });
          });
        });
        setTopicsCompleted(tCompleted);
        setHoursLogged(hLogged);

      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const stats = [
    {
      label: 'Topics Mastered',
      value: topicsCompleted,
      icon: HiOutlineAcademicCap,
      gradient: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
      bg: 'rgba(59, 130, 246, 0.1)',
    },
    {
      label: 'Study Hours Logged',
      value: hoursLogged,
      icon: HiOutlineClock,
      gradient: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
      bg: 'rgba(139, 92, 246, 0.1)',
    },
    {
      label: 'Active Journeys',
      value: roadmaps.length,
      icon: HiOutlineMap,
      gradient: 'linear-gradient(135deg, #10b981, #06b6d4)',
      bg: 'rgba(16, 185, 129, 0.1)',
    },
    {
      label: 'Avg Completion',
      value: roadmaps.length > 0
        ? `${Math.round(roadmaps.reduce((a, r) => a + (r.progress || 0), 0) / roadmaps.length)}%`
        : '0%',
      icon: HiOutlineChartBar,
      gradient: 'linear-gradient(135deg, #f59e0b, #ef4444)',
      bg: 'rgba(245, 158, 11, 0.1)',
    },
  ];

  const quickActions = [
    { label: 'Upload Document', href: '/documents', icon: HiOutlineArrowUpTray, color: '#3b82f6' },
    { label: 'Generate Mind Map', href: '/mindmap', icon: HiOutlineSparkles, color: '#ec4899' },
    { label: 'New Roadmap', href: '/roadmap', icon: HiOutlineMap, color: '#10b981' },
  ];

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const handleQuickAsk = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickQuery.trim()) return;
    // Simple way to pass state to chat, redirect with query param
    // In chat/page.tsx, if query param 'q' exists, prefill and send message
    router.push(`/chat?q=${encodeURIComponent(quickQuery)}`);
  };

  return (
    <div style={{ paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <motion.h1
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 4 }}
        >
          {greeting()}, {user?.name?.split(' ')[0]} 👋
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}
        >
          Here&apos;s your learning analytics and knowledge vault overview.
        </motion.p>
      </div>

      {/* Analytics Main Bar */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16, marginBottom: 24,
        }}
      >
        {stats.map((stat, i) => (
          <motion.div key={i} variants={item} className="glass-card stat-card-3d" style={{
            padding: 24, position: 'relative', overflow: 'hidden',
          }}>
            <div className="shimmer-bg" style={{ position: 'absolute', inset: 0, opacity: 0.5 }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, background: stat.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
              }}>
                <stat.icon size={20} style={{ color: stat.gradient.includes('#3b82f6') ? '#3b82f6' : stat.gradient.includes('#8b5cf6') ? '#8b5cf6' : stat.gradient.includes('#10b981') ? '#10b981' : '#f59e0b' }} />
              </div>
              <div style={{
                fontSize: '2rem', fontWeight: 800, background: stat.gradient,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1.1
              }}>
                {loading ? '...' : stat.value}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4, fontWeight: 500 }}>
                {stat.label}
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Content Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
        gap: 24,
      }}>
        {/* Left Column: Docs & Roadmaps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Active Journeys (Roadmaps) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="glass-card" style={{ padding: 24 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Active Learning Journeys</h2>
              <Link href="/roadmap" style={{ fontSize: '0.85rem', color: 'var(--accent-blue)', textDecoration: 'none' }}>View all →</Link>
            </div>

            {loading ? (
              <div className="shimmer-bg" style={{ height: 100, borderRadius: 12 }} />
            ) : roadmaps.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px dashed var(--border-subtle)' }}>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>No active roadmaps</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {roadmaps.slice(0, 3).map((rm) => (
                  <Link key={rm.id} href={`/roadmap?id=${rm.id}`} style={{
                    display: 'block', textDecoration: 'none', color: 'inherit',
                    background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: 12,
                    border: '1px solid var(--border-subtle)', transition: 'background 0.2s',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontSize: '1rem', fontWeight: 600 }}>{rm.roadmap_data.title || rm.goal}</div>
                      <span style={{ fontSize: '0.75rem', background: 'rgba(59,130,246,0.1)', color: 'var(--accent-blue)', padding: '4px 8px', borderRadius: 8, textTransform: 'capitalize' }}>{rm.level}</span>
                    </div>
                    <div className="progress-bar" style={{ height: 6, background: 'rgba(0,0,0,0.3)' }}>
                      <div className="progress-bar-fill" style={{ width: `${rm.progress || 0}%`, background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>
                      <span>{Math.round(rm.progress || 0)}% Completed</span>
                      <span>Next: Phase {rm.roadmap_data.phases?.findIndex(p => p.topics?.some(t => !t.completed)) + 1 || 1}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </motion.div>

          {/* Recent Documents */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="glass-card" style={{ padding: 24 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <HiOutlineDocumentText size={20} color="var(--accent-purple)"/>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Knowledge Vault ({docCount})</h2>
              </div>
              <Link href="/documents" style={{ fontSize: '0.85rem', color: 'var(--accent-blue)', textDecoration: 'none' }}>View all →</Link>
            </div>
            
            {loading ? (
              <div className="shimmer-bg" style={{ height: 200, borderRadius: 12 }} />
            ) : documents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px dashed var(--border-subtle)' }}>
                <HiOutlineDocumentText size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: 16 }}>Your vault is empty</p>
                <Link href="/documents" className="btn-gradient" style={{ padding: '8px 20px', fontSize: '0.85rem', textDecoration: 'none', borderRadius: 8 }}>Upload Document</Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {documents.map((doc) => (
                  <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', transition: 'all 0.2s', }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <HiOutlineDocumentText size={18} style={{ color: 'var(--accent-purple)' }} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '0.95rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>{(doc.file_size / 1024).toFixed(1)} KB • {new Date(doc.created_at).toLocaleDateString()}</div>
                    </div>
                    <span style={{ fontSize: '0.72rem', padding: '4px 10px', borderRadius: 8, background: doc.status === 'ready' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', color: doc.status === 'ready' ? '#10b981' : '#f59e0b', fontWeight: 600, letterSpacing: 0.5 }}>
                      {doc.status.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* Right Column: AI & Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* AI Knowledge Assistant Panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}
            className="glass-card" style={{ padding: '2px', background: 'linear-gradient(135deg, rgba(59,130,246,0.5), rgba(139,92,246,0.5))' }}
          >
            <div style={{ padding: 24, background: 'var(--bg-card)', borderRadius: 'inherit', height: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(139,92,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <HiOutlineSparkles size={20} color="var(--accent-purple)" />
                </div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  AI Assistant
                </h2>
              </div>
              
              <form onSubmit={handleQuickAsk} style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 8 }}>Ask your knowledge base</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={quickQuery} onChange={e => setQuickQuery(e.target.value)} placeholder="e.g. Explain quantum computing..." className="glass-input" style={{ flex: 1, fontSize: '0.9rem', padding: '10px 14px' }} />
                  <button type="submit" className="btn-gradient" style={{ padding: '0 16px', borderRadius: 8 }}>
                    <HiOutlineArrowUpTray size={18} style={{ transform: 'rotate(90deg)' }}/>
                  </button>
                </div>
              </form>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Link href="/chat" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', borderRadius: 12, textDecoration: 'none', color: 'inherit', transition: 'all 0.2s', textAlign: 'center' }}>
                  <HiOutlineChatBubbleLeftRight size={24} color="var(--accent-blue)" />
                  <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Global Chat</span>
                </Link>
                <Link href="/documents" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', borderRadius: 12, textDecoration: 'none', color: 'inherit', transition: 'all 0.2s', textAlign: 'center' }}>
                  <HiOutlineAcademicCap size={24} color="#10b981" />
                  <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Take a Quiz</span>
                </Link>
              </div>
            </div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}
            className="glass-card" style={{ padding: 24 }}
          >
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Quick Shortcuts</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {quickActions.map((action, i) => (
                <Link key={i} href={action.href} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px', borderRadius: 12,
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-subtle)',
                  textDecoration: 'none', color: 'inherit',
                  transition: 'background 0.2s',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: `${action.color}15`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <action.icon size={18} style={{ color: action.color }} />
                  </div>
                  <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{action.label}</span>
                </Link>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
