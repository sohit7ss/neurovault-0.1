'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CAREER_PATHS, getCareerData, calculateSkillGap, CareerPath } from '@/lib/careerData';
import { getUserProfile } from '@/lib/userProfile';
import { logActivity } from '@/lib/streakTracker';
import api from '@/lib/api';
import ResourceRecommender from '@/components/ResourceRecommender';
import {
  HiOutlineCurrencyDollar, HiOutlineClock, HiOutlineStar,
  HiOutlineArrowTrendingUp, HiOutlineArrowTrendingDown,
  HiOutlineCheckCircle, HiOutlineXCircle, HiOutlineSparkles,
} from 'react-icons/hi2';

export default function CareerSimulatorPage() {
  const careerKeys = Object.keys(CAREER_PATHS);
  const [selectedCareer, setSelectedCareer] = useState<string>(careerKeys[0]);
  const [careerData, setCareerData] = useState<CareerPath | null>(null);
  const [skillGap, setSkillGap] = useState<{ have: string[]; missing: string[]; percentage: number }>({ have: [], missing: [], percentage: 0 });
  const [aiInsight, setAiInsight] = useState('');
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Initial mount: pick career from profile if available
  useEffect(() => {
    logActivity('career_visit');
    const profile = getUserProfile();
    if (profile?.careerGoal && CAREER_PATHS[profile.careerGoal]) {
      setSelectedCareer(profile.careerGoal);
    }
    setMounted(true);
  }, []);

  // Recalculate whenever career selection changes
  useEffect(() => {
    if (!mounted) return;
    const data = getCareerData(selectedCareer);
    setCareerData(data);
    if (data) {
      const profile = getUserProfile();
      const userSkills = profile?.masteredSkills || [];
      setSkillGap(calculateSkillGap(userSkills, data.requiredSkills));
    }
    fetchAiInsight();
  }, [selectedCareer, mounted]);

  const fetchAiInsight = async () => {
    setLoadingInsight(true);
    setAiInsight('');
    try {
      const prompt = `Give a 2-3 sentence personalized career insight for someone aiming to become a ${selectedCareer}. Include current market trend and one specific actionable tip. Be concise and direct. No markdown formatting.`;
      const res = await api.queryAI(prompt);
      let text = res.answer;
      text = text.replace(/[#*_`]/g, '').replace(/\n{2,}/g, ' ').trim();
      if (text.length > 500) text = text.slice(0, 500) + '...';
      setAiInsight(text);
    } catch {
      setAiInsight(`The ${selectedCareer} role is in high demand. Focus on building foundational skills and progressively tackling more complex projects. Consistency and hands-on practice are key to success.`);
    } finally {
      setLoadingInsight(false);
    }
  };

  // Don't render until mounted (avoid SSR localStorage issues)
  if (!mounted || !careerData) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          style={{
            width: 36, height: 36, margin: '0 auto 16px',
            border: '3px solid rgba(59,130,246,0.2)',
            borderTopColor: '#3b82f6', borderRadius: '50%',
          }}
        />
        Loading Career Simulator...
      </div>
    );
  }

  const demandColor = careerData.demand === 'High' ? '#10b981' : careerData.demand === 'Medium' ? '#f59e0b' : '#ef4444';
  const trendIcon = careerData.demandTrend === 'up'
    ? <HiOutlineArrowTrendingUp size={18} />
    : careerData.demandTrend === 'down'
    ? <HiOutlineArrowTrendingDown size={18} />
    : <span style={{ fontSize: '1rem' }}>→</span>;
  const trendText = careerData.demandTrend === 'up' ? 'Growing demand' : careerData.demandTrend === 'down' ? 'Declining' : 'Stable market';
  const difficultyLabel = careerData.difficulty <= 2 ? 'Beginner Friendly' : careerData.difficulty <= 3 ? 'Moderate' : careerData.difficulty <= 4 ? 'Challenging' : 'Expert Level';

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 4 }}>Career Simulator</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Explore career paths and plan your future
        </p>
      </div>

      {/* Career Selector */}
      <div className="glass-card" style={{ padding: 20, marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 8 }}>
          Select a Career Path
        </label>
        <select
          value={selectedCareer}
          onChange={e => setSelectedCareer(e.target.value)}
          className="glass-input"
          style={{ width: '100%', fontSize: '1.05rem', fontWeight: 600, cursor: 'pointer' }}
        >
          {careerKeys.map(k => (
            <option key={k} value={k} style={{ background: '#161836', color: '#f1f5f9' }}>{k}</option>
          ))}
        </select>
        {careerData.description && (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 10 }}>
            {careerData.description}
          </p>
        )}
      </div>

      {/* 4 Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>

        {/* Card 1: Salary */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, color: '#10b981' }}>
            <HiOutlineCurrencyDollar size={20} />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Expected Salary</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Entry', val: careerData.salaryEntry, color: '#10b981' },
              { label: 'Mid', val: careerData.salaryMid, color: '#3b82f6' },
              { label: 'Senior', val: careerData.salarySenior, color: '#8b5cf6' },
            ].map((s, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>{s.label}</span>
                <span style={{ fontWeight: 600, color: s.color }}>{s.val}</span>
              </div>
            ))}
          </div>
          <div style={{
            height: 6, borderRadius: 6, marginTop: 12,
            background: 'linear-gradient(90deg, #10b981, #3b82f6, #8b5cf6)',
          }} />
        </motion.div>

        {/* Card 2: Time to Ready */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="glass-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, color: '#3b82f6' }}>
            <HiOutlineClock size={20} />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Time to Job-Ready</span>
          </div>
          <div style={{
            fontSize: '1.8rem', fontWeight: 800, marginBottom: 4,
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            {careerData.timeToReady}
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>based on 2hrs/day pace</p>
        </motion.div>

        {/* Card 3: Difficulty */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="glass-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, color: '#f59e0b' }}>
            <HiOutlineStar size={20} />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Difficulty Level</span>
          </div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            {[1, 2, 3, 4, 5].map(s => (
              <span
                key={s}
                style={{
                  fontSize: '1.5rem',
                  color: s <= careerData.difficulty ? '#f59e0b' : 'rgba(255,255,255,0.1)',
                }}
              >
                ★
              </span>
            ))}
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {difficultyLabel}
          </p>
        </motion.div>

        {/* Card 4: Job Demand */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="glass-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, color: demandColor }}>
            {trendIcon}
            <span style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Job Market Demand</span>
          </div>
          <div style={{
            fontSize: '1.8rem', fontWeight: 800, color: demandColor,
            marginBottom: 4,
          }}>
            {careerData.demand}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: demandColor, fontSize: '1.1rem' }}>
              {careerData.demandTrend === 'up' ? '↑' : careerData.demandTrend === 'down' ? '↓' : '→'}
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{trendText}</span>
          </div>
        </motion.div>
      </div>

      {/* Learning Timeline — full width */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="glass-card" style={{ padding: 28, marginBottom: 24 }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 28 }}>🗺️ Learning Timeline</h3>
        <div style={{ position: 'relative', padding: '0 24px' }}>
          {/* Track background */}
          <div style={{
            position: 'absolute', left: 24, right: 24, top: 8,
            height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.06)',
          }} />
          {/* Track progress fill */}
          <div style={{
            position: 'absolute', left: 24, top: 8,
            height: 4, borderRadius: 4,
            width: `${Math.min(skillGap.percentage, 100) * 0.9}%`,
            background: 'linear-gradient(90deg, #3b82f6, #6366f1)',
            transition: 'width 0.8s ease',
          }} />

          {/* Milestones */}
          <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
            {/* Start */}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', margin: '0 auto 8px',
                background: '#3b82f6', border: '3px solid rgba(59,130,246,0.3)',
              }} />
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#3b82f6' }}>You Are Here</div>
            </div>

            {/* Middle milestones */}
            {['Core Skills', 'Projects', 'Portfolio'].map((milestone, i) => {
              const passed = skillGap.percentage > (i + 1) * 25;
              return (
                <div key={milestone} style={{ textAlign: 'center' }}>
                  <div style={{
                    width: 14, height: 14, borderRadius: '50%', margin: '3px auto 11px',
                    background: passed ? '#6366f1' : 'rgba(255,255,255,0.08)',
                    border: `2px solid ${passed ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.1)'}`,
                    transition: 'all 0.5s',
                  }} />
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{milestone}</div>
                </div>
              );
            })}

            {/* End */}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', margin: '0 auto 8px',
                background: skillGap.percentage >= 100 ? '#10b981' : 'rgba(255,255,255,0.08)',
                border: `3px solid ${skillGap.percentage >= 100 ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.6rem',
              }}>
                🎯
              </div>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>Job Ready</div>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          You&apos;re <span style={{ color: '#3b82f6', fontWeight: 700 }}>{skillGap.percentage}%</span> of the way there
        </div>
      </motion.div>

      {/* Skill Gap — 2 columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        {/* Skills You Have */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="glass-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#10b981', marginBottom: 16 }}>
            ✅ Skills You Have ({skillGap.have.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {skillGap.have.length > 0 ? (
              skillGap.have.map((skill, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <HiOutlineCheckCircle size={16} color="#10b981" />
                  {skill}
                </div>
              ))
            ) : (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Complete your profile to see matched skills. Add mastered skills from your roadmaps or quiz results.
              </p>
            )}
          </div>
        </motion.div>

        {/* Skills to Learn */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="glass-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#ef4444', marginBottom: 16 }}>
            ❌ Skills to Learn ({skillGap.missing.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {skillGap.missing.map((skill, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <HiOutlineXCircle size={16} color="#ef4444" />
                {skill}
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* AI Career Insight */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
        className="glass-card" style={{
          padding: 24,
          background: 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(59,130,246,0.06))',
          border: '1px solid rgba(139,92,246,0.15)',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <HiOutlineSparkles size={20} color="#8b5cf6" />
          <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>AI Career Insight</h3>
        </div>
        {loadingInsight ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.04)', width: '100%' }} />
            <div style={{ height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.04)', width: '80%' }} />
            <div style={{ height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.04)', width: '60%' }} />
          </div>
        ) : (
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            {aiInsight}
          </p>
        )}
      </motion.div>

      {/* Resource Recommender for selected career */}
      <ResourceRecommender careerGoal={selectedCareer} />
    </div>
  );
}
