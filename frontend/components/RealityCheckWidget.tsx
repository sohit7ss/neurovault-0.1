'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { getUserProfile } from '@/lib/userProfile';
import { getStreak, getHeatmapData } from '@/lib/streakTracker';
import { HiOutlineExclamationTriangle, HiOutlineCheckCircle, HiOutlineClock } from 'react-icons/hi2';

export default function RealityCheckWidget() {
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<'green' | 'yellow' | 'red'>('green');
  const [message, setMessage] = useState('');
  const [paceMessage, setPaceMessage] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [inactiveDays, setInactiveDays] = useState(0);

  useEffect(() => {
    const profile = getUserProfile();
    const goal = profile.goals?.find(g => g.status === 'active');

    if (!goal) {
      setMessage('Set a learning goal to get your reality check');
      setStatus('yellow');
      setRecommendation('Create a goal from the dashboard to track your progress.');
      setMounted(true);
      return;
    }

    // Calculate days remaining
    const targetDate = new Date(goal.targetDate);
    const today = new Date();
    const daysRemaining = Math.max(0, Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

    // Calculate progress
    const totalTasks = goal.tasks.length;
    const completedTasks = goal.tasks.filter(t => t.completed).length;
    const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const remainingPct = 100 - progressPct;

    // Calculate required daily hours
    const dailyHours = parseFloat(profile.dailyTime) || 1.5;

    // Check inactive days
    const heatmap = getHeatmapData();
    const recentDays = heatmap.slice(-7);
    const inactive = recentDays.filter(d => d.count === 0).length;
    setInactiveDays(inactive);

    // Estimate completion
    const daysElapsed = Math.max(1, Math.ceil((today.getTime() - new Date(goal.createdAt).getTime()) / (1000 * 60 * 60 * 24)));
    const dailyProgressRate = progressPct / daysElapsed;
    const estimatedDaysToComplete = dailyProgressRate > 0 ? Math.ceil(remainingPct / dailyProgressRate) : 999;

    if (daysRemaining <= 0) {
      if (progressPct >= 100) {
        setStatus('green');
        setMessage('🎉 You\'ve reached your target date — great work!');
        setPaceMessage(`Completed ${completedTasks}/${totalTasks} tasks.`);
        setRecommendation('Set your next goal to keep the momentum going.');
      } else {
        setStatus('red');
        setMessage(`Target date has passed — you're at ${progressPct}%`);
        setPaceMessage(`${totalTasks - completedTasks} tasks remaining.`);
        setRecommendation('Update your target date and increase daily study time to catch up.');
      }
    } else if (estimatedDaysToComplete <= daysRemaining) {
      setStatus('green');
      setMessage(`On track — ${daysRemaining} days left, ${progressPct}% complete`);
      setPaceMessage(`At your current pace, you'll finish in ~${estimatedDaysToComplete} days.`);
      setRecommendation(`Keep going! Complete ${Math.ceil(remainingPct / daysRemaining)}% per day to stay on target.`);
    } else if (estimatedDaysToComplete <= daysRemaining * 1.5) {
      const requiredHours = Math.round(dailyHours * (estimatedDaysToComplete / daysRemaining) * 10) / 10;
      setStatus('yellow');
      setMessage(`Slightly behind — you need to pick up the pace`);
      setPaceMessage(`At current rate: ${estimatedDaysToComplete} days needed, but only ${daysRemaining} days left.`);
      setRecommendation(`Increase daily study to ${requiredHours} hrs/day (from ${dailyHours} hrs) to finish on time.`);
    } else {
      const requiredHours = Math.round(dailyHours * (estimatedDaysToComplete / daysRemaining) * 10) / 10;
      setStatus('red');
      setMessage(`Significantly behind — action needed now`);
      setPaceMessage(`At current rate: ~${estimatedDaysToComplete} days needed, but only ${daysRemaining} left.`);
      setRecommendation(`You need ${requiredHours} hrs/day instead of ${dailyHours} hrs. Focus on high-impact tasks first.`);
    }

    if (inactive >= 3) {
      setPaceMessage(prev => prev + ` You've been inactive for ${inactive} of the last 7 days.`);
    }

    setMounted(true);
  }, []);

  if (!mounted) return null;

  const colors = {
    green: { bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.15)', text: '#6ee7b7', icon: '#10b981' },
    yellow: { bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.15)', text: '#fbbf24', icon: '#f59e0b' },
    red: { bg: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.15)', text: '#fca5a5', icon: '#ef4444' },
  };
  const c = colors[status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="glass-card"
      style={{
        padding: 20, background: c.bg,
        border: `1px solid ${c.border}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        {status === 'green' ? <HiOutlineCheckCircle size={20} style={{ color: c.icon }} />
          : status === 'yellow' ? <HiOutlineClock size={20} style={{ color: c.icon }} />
          : <HiOutlineExclamationTriangle size={20} style={{ color: c.icon }} />}
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: c.text }}>Reality Check</h3>
      </div>

      <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, lineHeight: 1.5 }}>
        {message}
      </p>

      {paceMessage && (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
          {paceMessage}
        </p>
      )}

      <div style={{
        padding: '10px 14px', borderRadius: 8,
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)',
        fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6,
      }}>
        💡 <strong>Action:</strong> {recommendation}
      </div>
    </motion.div>
  );
}
