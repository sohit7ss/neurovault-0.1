'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DSA_TOPICS, TOTAL_PROBLEMS, getSolvedCount, getDSAXP, DSATopic } from '@/lib/dsaProblems';
import { getUserProfile, updateUserProfile } from '@/lib/userProfile';
import { logActivity } from '@/lib/streakTracker';
import { HiOutlineCheckCircle, HiOutlineFunnel, HiOutlineTrophy } from 'react-icons/hi2';

type Filter = 'all' | 'solved' | 'unsolved' | 'Easy' | 'Medium' | 'Hard';

export default function DSATrackerPage() {
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [activeTopic, setActiveTopic] = useState(0);
  const [filter, setFilter] = useState<Filter>('all');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    logActivity('dsa_visit');
    const profile = getUserProfile();
    setProgress(profile.dsaProgress || {});
    setMounted(true);
  }, []);

  const toggleProblem = (id: string) => {
    const updated = { ...progress, [id]: !progress[id] };
    setProgress(updated);
    const xp = getDSAXP(updated);
    updateUserProfile({ dsaProgress: updated, dsaXP: xp });
    logActivity('dsa_solve');
  };

  const solved = getSolvedCount(progress);
  const xp = getDSAXP(progress);
  const pct = Math.round((solved / TOTAL_PROBLEMS) * 100);

  const currentTopic = DSA_TOPICS[activeTopic];
  const filteredProblems = currentTopic.problems.filter(p => {
    if (filter === 'solved') return progress[p.id];
    if (filter === 'unsolved') return !progress[p.id];
    if (filter === 'Easy' || filter === 'Medium' || filter === 'Hard') return p.difficulty === filter;
    return true;
  });

  const topicSolved = (t: DSATopic) => t.problems.filter(p => progress[p.id]).length;

  const diffColor = (d: string) => d === 'Easy' ? '#10b981' : d === 'Medium' ? '#f59e0b' : '#ef4444';

  if (!mounted) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 4 }}>DSA Tracker</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Master {TOTAL_PROBLEMS} essential problems for placements
        </p>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        {/* Progress Ring */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card" style={{ padding: 20, textAlign: 'center' }}>
          <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 10px' }}>
            <svg width="80" height="80" viewBox="0 0 36 36">
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none" stroke="url(#dsaGrad)" strokeWidth="3"
                strokeDasharray={`${pct}, 100`} strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 0.5s' }} />
              <defs>
                <linearGradient id="dsaGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 700, color: '#818cf8' }}>
              {pct}%
            </div>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Overall Progress</div>
        </motion.div>

        {/* Solved */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="glass-card" style={{ padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 800, background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {solved}<span style={{ fontSize: '1rem', fontWeight: 400 }}>/{TOTAL_PROBLEMS}</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>Problems Solved</div>
        </motion.div>

        {/* XP */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="glass-card" style={{ padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f59e0b' }}>
            {xp} <span style={{ fontSize: '0.8rem', fontWeight: 400 }}>XP</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>Points Earned</div>
        </motion.div>

        {/* Difficulty Breakdown */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="glass-card" style={{ padding: 20 }}>
          {(['Easy', 'Medium', 'Hard'] as const).map(d => {
            const total = DSA_TOPICS.flatMap(t => t.problems).filter(p => p.difficulty === d).length;
            const done = DSA_TOPICS.flatMap(t => t.problems).filter(p => p.difficulty === d && progress[p.id]).length;
            return (
              <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: diffColor(d), flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{d}</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: diffColor(d) }}>{done}/{total}</span>
              </div>
            );
          })}
        </motion.div>
      </div>

      {/* Topic Tabs + Problems */}
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20 }}>
        {/* Topic Sidebar */}
        <div className="glass-card" style={{ padding: 12 }}>
          {DSA_TOPICS.map((t, i) => {
            const s = topicSolved(t);
            const isActive = i === activeTopic;
            return (
              <button key={t.name} onClick={() => { setActiveTopic(i); setFilter('all'); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px',
                  borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  background: isActive ? 'rgba(99,102,241,0.12)' : 'transparent',
                  color: isActive ? '#818cf8' : 'var(--text-secondary)',
                  fontSize: '0.82rem', fontWeight: isActive ? 600 : 400, textAlign: 'left',
                  transition: 'all 0.15s',
                }}>
                <span style={{ fontSize: '1rem' }}>{t.icon}</span>
                <span style={{ flex: 1 }}>{t.name}</span>
                <span style={{ fontSize: '0.72rem', color: s === t.problems.length ? '#10b981' : 'var(--text-muted)' }}>
                  {s}/{t.problems.length}
                </span>
              </button>
            );
          })}
        </div>

        {/* Problem List */}
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>
              {currentTopic.icon} {currentTopic.name}
              <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>
                {topicSolved(currentTopic)}/{currentTopic.problems.length} solved
              </span>
            </h3>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['all', 'unsolved', 'Easy', 'Medium', 'Hard'] as Filter[]).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  style={{
                    padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    fontSize: '0.72rem', fontFamily: 'inherit', fontWeight: 500,
                    background: filter === f ? 'rgba(99,102,241,0.15)' : 'transparent',
                    color: filter === f ? '#818cf8' : 'var(--text-muted)', transition: 'all 0.15s',
                  }}>{f === 'all' ? 'All' : f}</button>
              ))}
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.06)', marginBottom: 16 }}>
            <div style={{
              height: '100%', borderRadius: 4, transition: 'width 0.4s',
              width: `${(topicSolved(currentTopic) / currentTopic.problems.length) * 100}%`,
              background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
            }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <AnimatePresence mode="popLayout">
              {filteredProblems.map(p => (
                <motion.div key={p.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                    borderRadius: 8, cursor: 'pointer', transition: 'background 0.15s',
                    background: progress[p.id] ? 'rgba(16,185,129,0.05)' : 'transparent',
                    border: `1px solid ${progress[p.id] ? 'rgba(16,185,129,0.15)' : 'transparent'}`,
                  }}
                  onClick={() => toggleProblem(p.id)}
                  onMouseOver={e => { if (!progress[p.id]) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                  onMouseOut={e => { if (!progress[p.id]) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: 6,
                    border: `2px solid ${progress[p.id] ? '#10b981' : 'rgba(255,255,255,0.15)'}`,
                    background: progress[p.id] ? '#10b981' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s', flexShrink: 0,
                  }}>
                    {progress[p.id] && <span style={{ color: '#fff', fontSize: '0.7rem', fontWeight: 700 }}>✓</span>}
                  </div>
                  <span style={{
                    flex: 1, fontSize: '0.88rem',
                    color: progress[p.id] ? 'var(--text-muted)' : 'var(--text-primary)',
                    textDecoration: progress[p.id] ? 'line-through' : 'none',
                  }}>{p.name}</span>
                  <span style={{
                    padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600,
                    color: diffColor(p.difficulty),
                    background: `${diffColor(p.difficulty)}15`,
                  }}>{p.difficulty}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    +{p.difficulty === 'Easy' ? 10 : p.difficulty === 'Medium' ? 20 : 30} XP
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
            {filteredProblems.length === 0 && (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No problems match this filter
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
