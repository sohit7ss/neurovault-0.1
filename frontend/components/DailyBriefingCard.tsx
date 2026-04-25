'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { getUserProfile, CareerMatchResult } from '@/lib/userProfile';
import { getStreak, hasActivityToday } from '@/lib/streakTracker';
import { getCardsDueToday } from '@/lib/flashcardStore';
import { calculateSkillGap, CAREER_PATHS } from '@/lib/careerData';
import { Roadmap } from '@/lib/api';
import { HiOutlineSparkles, HiOutlineAcademicCap, HiOutlineMap, HiOutlineSquares2X2 } from 'react-icons/hi2';

interface Props {
  userName: string;
  roadmaps: Roadmap[];
}

export default function DailyBriefingCard({ userName, roadmaps }: Props) {
  const [mounted, setMounted] = useState(false);
  const [streak, setStreak] = useState(0);
  const [dueCards, setDueCards] = useState(0);
  const [careerNudge, setCareerNudge] = useState('');
  const [todayTopic, setTodayTopic] = useState('');
  const [hasRoadmap, setHasRoadmap] = useState(false);
  const [matchBadge, setMatchBadge] = useState<CareerMatchResult | null>(null);

  useEffect(() => {
    const profile = getUserProfile();
    setStreak(getStreak());
    setMatchBadge(profile.careerMatchResult || null);

    // Due flashcards
    try { setDueCards(getCardsDueToday().length); } catch { setDueCards(0); }

    // Career nudge
    if (profile.careerGoal && CAREER_PATHS[profile.careerGoal]) {
      const gap = calculateSkillGap(profile.masteredSkills || [], CAREER_PATHS[profile.careerGoal].requiredSkills);
      setCareerNudge(`${profile.careerGoal} requires ${CAREER_PATHS[profile.careerGoal].requiredSkills[0]} mastery — you're ${gap.percentage}% there`);
    }

    // Today's topic from roadmap
    if (roadmaps.length > 0) {
      setHasRoadmap(true);
      const rm = roadmaps[0];
      const phases = rm.roadmap_data?.phases || [];
      for (const phase of phases) {
        const incomplete = phase.topics?.find((t: { completed?: boolean }) => !t.completed);
        if (incomplete) {
          setTodayTopic(incomplete.title || phase.title || 'Next topic');
          break;
        }
      }
    }

    setMounted(true);
  }, [roadmaps]);

  if (!mounted) return null;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = userName?.split(' ')[0] || 'Student';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card"
      style={{
        padding: 24,
        marginBottom: 24,
        background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(59,130,246,0.04), rgba(139,92,246,0.04))',
        border: '1px solid rgba(99,102,241,0.12)',
      }}
    >
      {/* Greeting */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 4 }}>
            {greeting}, {firstName} 👋
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            Here&apos;s your plan for today
          </p>
        </div>
        {matchBadge && (
          <div style={{
            padding: '5px 12px', borderRadius: 8, fontSize: '0.72rem', fontWeight: 600,
            background: 'rgba(139,92,246,0.12)', color: '#a78bfa',
            border: '1px solid rgba(139,92,246,0.2)',
          }}>
            🎯 {matchBadge.career} ({matchBadge.percentage}% fit)
          </div>
        )}
      </div>

      {/* Info Pills */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 18 }}>
        {/* Today's topic */}
        <div style={{
          padding: '12px 14px', borderRadius: 10,
          background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.1)',
        }}>
          <div style={{ fontSize: '0.7rem', color: '#93c5fd', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
            📖 Today&apos;s Topic
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>
            {todayTopic || (hasRoadmap ? 'All topics complete!' : 'Create a roadmap to get started')}
          </div>
        </div>

        {/* Flashcards due */}
        <div style={{
          padding: '12px 14px', borderRadius: 10,
          background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.1)',
        }}>
          <div style={{ fontSize: '0.7rem', color: '#fbbf24', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
            🃏 Flashcards Due
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>
            {dueCards > 0 ? `${dueCards} cards awaiting review` : 'All caught up!'}
          </div>
        </div>

        {/* Streak */}
        <div style={{
          padding: '12px 14px', borderRadius: 10,
          background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.1)',
        }}>
          <div style={{ fontSize: '0.7rem', color: '#f87171', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
            🔥 Streak
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>
            {streak > 0
              ? `${streak} day${streak > 1 ? 's' : ''} — don't break it!`
              : 'Start your streak today!'}
          </div>
        </div>
      </div>

      {/* Career nudge */}
      {careerNudge && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, marginBottom: 18,
          background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.08)',
          fontSize: '0.82rem', color: 'var(--text-secondary)',
        }}>
          💡 {careerNudge}
        </div>
      )}

      {/* Quick Actions */}
      <div style={{ display: 'flex', gap: 10 }}>
        <Link href="/quiz" style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8,
          background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)',
          color: '#a5b4fc', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none',
        }}><HiOutlineAcademicCap size={15} /> Start Quiz</Link>

        <Link href="/flashcards" style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8,
          background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.15)',
          color: '#fbbf24', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none',
        }}><HiOutlineSquares2X2 size={15} /> Review Cards</Link>

        <Link href="/roadmap" style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8,
          background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.15)',
          color: '#6ee7b7', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none',
        }}><HiOutlineMap size={15} /> Continue Roadmap</Link>

        {!matchBadge && (
          <Link href="/career-match" style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8,
            background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.15)',
            color: '#c4b5fd', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none',
          }}><HiOutlineSparkles size={15} /> Find My Career</Link>
        )}
      </div>
    </motion.div>
  );
}
