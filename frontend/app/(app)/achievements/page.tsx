'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import api from '@/lib/api';
import {
  HiOutlineTrophy, HiOutlineDocumentText, HiOutlineChatBubbleLeftRight,
  HiOutlineMap, HiOutlineAcademicCap, HiOutlineFire, HiOutlineStar,
  HiOutlineLightBulb,
} from 'react-icons/hi2';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  threshold: number;
  current: number;
  unlocked: boolean;
}

export default function AchievementsPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ docs: 0, roadmaps: 0, level: 1, xp: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [docsRes, rmRes] = await Promise.all([
          api.getDocuments(1, 1),
          api.getRoadmaps(),
        ]);
        const docs = docsRes.total;
        const roadmaps = rmRes.roadmaps.length;
        const xp = docs * 50 + roadmaps * 100;
        const level = Math.floor(xp / 200) + 1;
        setStats({ docs, roadmaps, level, xp });
      } catch { /* ignore */ }
    };
    fetchStats();
  }, []);

  const achievements: Achievement[] = [
    {
      id: 'first_doc', title: 'First Upload', description: 'Upload your first document',
      icon: HiOutlineDocumentText, color: '#3b82f6', threshold: 1, current: stats.docs,
      unlocked: stats.docs >= 1,
    },
    {
      id: 'knowledge_seeker', title: 'Knowledge Seeker', description: 'Upload 5 documents',
      icon: HiOutlineLightBulb, color: '#f59e0b', threshold: 5, current: stats.docs,
      unlocked: stats.docs >= 5,
    },
    {
      id: 'library_builder', title: 'Library Builder', description: 'Upload 25 documents',
      icon: HiOutlineStar, color: '#ec4899', threshold: 25, current: stats.docs,
      unlocked: stats.docs >= 25,
    },
    {
      id: 'scholar', title: 'Scholar', description: 'Upload 100 documents',
      icon: HiOutlineTrophy, color: '#8b5cf6', threshold: 100, current: stats.docs,
      unlocked: stats.docs >= 100,
    },
    {
      id: 'first_roadmap', title: 'Pathfinder', description: 'Create your first roadmap',
      icon: HiOutlineMap, color: '#10b981', threshold: 1, current: stats.roadmaps,
      unlocked: stats.roadmaps >= 1,
    },
    {
      id: 'explorer', title: 'Explorer', description: 'Create 5 learning roadmaps',
      icon: HiOutlineFire, color: '#ef4444', threshold: 5, current: stats.roadmaps,
      unlocked: stats.roadmaps >= 5,
    },
    {
      id: 'ai_user', title: 'AI Whisperer', description: 'Ask AI 10 questions',
      icon: HiOutlineChatBubbleLeftRight, color: '#06b6d4', threshold: 10, current: 0,
      unlocked: false,
    },
    {
      id: 'quiz_master', title: 'Quiz Master', description: 'Complete 10 quizzes',
      icon: HiOutlineAcademicCap, color: '#a855f7', threshold: 10, current: 0,
      unlocked: false,
    },
  ];

  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const xpToNext = (stats.level * 200) - stats.xp;

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 4 }}>Achievements</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Track your progress and unlock achievements as you build your knowledge
        </p>
      </div>

      {/* XP & Level Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="glass-card" style={{ padding: 28, marginBottom: 28, position: 'relative', overflow: 'hidden' }}>
        <div className="shimmer-bg" style={{ position: 'absolute', inset: 0, opacity: 0.5 }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, position: 'relative',
          }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800 }}>{stats.level}</span>
            <div style={{
              position: 'absolute', bottom: -4, right: -4,
              background: 'var(--bg-primary)', borderRadius: 8, padding: '2px 8px',
              fontSize: '0.7rem', fontWeight: 600, color: 'var(--accent-blue)',
              border: '1px solid var(--border-default)',
            }}>
              LVL
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 4 }}>{user?.name}</h2>
            <div style={{ display: 'flex', gap: 24, marginBottom: 10 }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--accent-blue)' }}>{stats.xp}</strong> XP
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--accent-purple)' }}>{unlockedCount}</strong>/{achievements.length} Achievements
              </span>
            </div>
            <div className="progress-bar" style={{ height: 8, marginBottom: 4 }}>
              <div className="progress-bar-fill" style={{
                width: `${Math.min(100, (stats.xp % 200) / 2)}%`,
                background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
              }} />
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {xpToNext > 0 ? `${xpToNext} XP to Level ${stats.level + 1}` : 'Max level reached!'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            {[
              { label: 'Documents', value: stats.docs, color: '#3b82f6' },
              { label: 'Roadmaps', value: stats.roadmaps, color: '#10b981' },
            ].map((s, i) => (
              <div key={i} style={{
                textAlign: 'center', padding: '12px 20px', borderRadius: 12,
                background: `${s.color}10`, border: `1px solid ${s.color}20`,
              }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Achievement Grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16,
      }}>
        {achievements.map((a, i) => (
          <motion.div key={a.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card" style={{
              padding: 20, opacity: a.unlocked ? 1 : 0.5,
              position: 'relative', overflow: 'hidden',
            }}>
            {a.unlocked && (
              <div style={{
                position: 'absolute', top: 12, right: 12,
                fontSize: '0.7rem', padding: '2px 8px', borderRadius: 6,
                background: 'rgba(16,185,129,0.15)', color: '#10b981', fontWeight: 600,
              }}>
                ✓ Unlocked
              </div>
            )}
            <div style={{
              width: 48, height: 48, borderRadius: 12, marginBottom: 14,
              background: a.unlocked ? `${a.color}20` : 'rgba(255,255,255,0.03)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <a.icon size={24} style={{ color: a.unlocked ? a.color : 'var(--text-muted)' }} />
            </div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 4 }}>{a.title}</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 12 }}>
              {a.description}
            </p>
            <div className="progress-bar" style={{ height: 6 }}>
              <div className="progress-bar-fill" style={{
                width: `${Math.min(100, (a.current / a.threshold) * 100)}%`,
                background: a.unlocked ? a.color : 'rgba(255,255,255,0.1)',
              }} />
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
              {Math.min(a.current, a.threshold)}/{a.threshold}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
