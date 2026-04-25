'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart, Line, BarChart, Bar, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Area, AreaChart, CartesianGrid,
} from 'recharts';
import ActivityHeatmap from '@/components/ActivityHeatmap';
import { getHeatmapData } from '@/lib/streakTracker';
import { getUserProfile } from '@/lib/userProfile';
import { getCareerData } from '@/lib/careerData';
import { logActivity } from '@/lib/streakTracker';
import { HiOutlineLightBulb, HiOutlinePrinter } from 'react-icons/hi2';

export default function AnalyticsPage() {
  const [heatmap, setHeatmap] = useState<{ date: string; count: number }[]>([]);
  const [profile, setProfile] = useState(getUserProfile());

  useEffect(() => {
    logActivity('analytics_visit');
    setHeatmap(getHeatmapData());
    setProfile(getUserProfile());
  }, []);

  // Generate study hours data (last 8 weeks)
  const weeklyHours = Array.from({ length: 8 }, (_, i) => {
    const weekAgo = 7 - i;
    const base = 3 + Math.random() * 7;
    return {
      week: `W${i + 1}`,
      hours: Math.round(base * 10) / 10,
    };
  });

  // Topics mastered bar chart
  const topics = [
    { subject: 'Python', mastered: 12 },
    { subject: 'JavaScript', mastered: 8 },
    { subject: 'ML', mastered: 5 },
    { subject: 'Databases', mastered: 7 },
    { subject: 'DevOps', mastered: 3 },
    { subject: 'Algorithms', mastered: 9 },
  ];

  // Radar chart — skill coverage from career path
  const career = getCareerData(profile.careerGoal || 'Frontend Developer');
  const radarData = (career?.requiredSkills || ['Python', 'JavaScript', 'React', 'SQL', 'Git', 'Testing'])
    .slice(0, 6)
    .map(skill => ({
      skill: skill.length > 12 ? skill.slice(0, 10) + '…' : skill,
      value: Math.floor(Math.random() * 60) + 20,
      fullMark: 100,
    }));

  // Insights
  const insights = [
    { text: 'You\'re most active on weekdays — consider light study on weekends too.', icon: '📊' },
    { text: `${profile.careerGoal || 'Programming'} is your most studied area — great focus!`, icon: '🎯' },
    { text: 'You\'re 73% toward your weekly goal. Keep pushing!', icon: '🔥' },
  ];

  const tooltipStyle = {
    contentStyle: {
      background: 'rgba(22,24,54,0.95)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 10,
      fontSize: '0.8rem',
      color: '#f1f5f9',
    },
  };

  return (
    <div className="analytics-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 4 }}>Analytics</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Visualize your learning journey
          </p>
        </div>
        <button onClick={() => window.print()} style={{
          padding: '10px 18px', borderRadius: 10, cursor: 'pointer',
          background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-default)',
          color: 'var(--text-secondary)', fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <HiOutlinePrinter size={16} /> Export Report
        </button>
      </div>

      {/* Row 1: Line + Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 20 }}>📈 Study Hours Per Week</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={weeklyHours}>
              <defs>
                <linearGradient id="hoursGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="week" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} />
              <Tooltip {...tooltipStyle} />
              <Area type="monotone" dataKey="hours" stroke="#3b82f6" strokeWidth={2.5}
                fill="url(#hoursGrad)" dot={{ fill: '#3b82f6', r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="glass-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 20 }}>📊 Topics Mastered</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topics}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} />
              <Tooltip {...tooltipStyle} />
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
              </defs>
              <Bar dataKey="mastered" fill="url(#barGrad)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Row 2: Radar + Heatmap */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="glass-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 20 }}>🎯 Skill Coverage</h3>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(255,255,255,0.06)" />
              <PolarAngleAxis dataKey="skill" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <PolarRadiusAxis tick={false} axisLine={false} />
              <Radar name="Coverage" dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="glass-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 20 }}>📅 Activity Calendar</h3>
          <ActivityHeatmap data={heatmap} />
        </motion.div>
      </div>

      {/* Row 3: Insights */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <HiOutlineLightBulb size={20} color="#f59e0b" /> Insights
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {insights.map((ins, i) => (
            <div key={i} className="glass-card" style={{
              padding: 20, display: 'flex', alignItems: 'flex-start', gap: 12,
            }}>
              <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{ins.icon}</span>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {ins.text}
              </p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Print styles */}
      <style jsx>{`
        @media print {
          .analytics-page {
            background: white !important;
            color: black !important;
          }
        }
      `}</style>
    </div>
  );
}
