'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getUserProfile, updateUserProfile, UserGoal, GoalTask } from '@/lib/userProfile';
import { HiOutlineXMark, HiOutlineSparkles } from 'react-icons/hi2';
import api from '@/lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
  onGoalCreated: (goal: UserGoal) => void;
}

export default function GoalModal({ open, onClose, onGoalCreated }: Props) {
  const [goalText, setGoalText] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [hoursPerDay, setHoursPerDay] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!goalText.trim() || !targetDate) return;
    setLoading(true);
    setError('');

    try {
      const prompt = `Generate a structured weekly learning plan for the goal: "${goalText}". 
The user has ${hoursPerDay} hours per day available. Target completion date: ${targetDate}. 
Return ONLY a valid JSON array of week objects: [{"week": 1, "tasks": ["task1", "task2", "task3"]}]. 
Generate 4-6 weeks with 3-5 specific, actionable daily tasks each. Keep task descriptions concise (under 15 words each).`;

      const res = await api.queryAI(prompt);
      let tasks: GoalTask[] = [];

      try {
        let parsed = res.answer;
        // Extract JSON from markdown code block if present
        const jsonMatch = parsed.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) parsed = jsonMatch[1];
        // Try finding JSON array
        const arrMatch = parsed.match(/\[[\s\S]*\]/);
        if (arrMatch) {
          const weeks = JSON.parse(arrMatch[0]);
          weeks.forEach((w: { week: number; tasks: string[] }) => {
            w.tasks.forEach((t: string, di: number) => {
              tasks.push({
                id: `${Date.now()}-${w.week}-${di}`,
                text: t,
                completed: false,
                week: w.week,
                day: di + 1,
              });
            });
          });
        }
      } catch {
        // Fallback: create generic tasks
        for (let w = 1; w <= 4; w++) {
          for (let d = 1; d <= 3; d++) {
            tasks.push({
              id: `${Date.now()}-${w}-${d}`,
              text: `Week ${w}, Day ${d}: Study session for "${goalText}"`,
              completed: false,
              week: w,
              day: d,
            });
          }
        }
      }

      const newGoal: UserGoal = {
        id: Date.now().toString(36),
        text: goalText,
        targetDate,
        hoursPerDay,
        tasks,
        status: 'active',
        createdAt: new Date().toISOString(),
      };

      const profile = getUserProfile();
      // Deactivate existing active goals
      const updatedGoals = profile.goals.map(g =>
        g.status === 'active' ? { ...g, status: 'completed' as const } : g
      );
      updatedGoals.push(newGoal);
      updateUserProfile({ goals: updatedGoals });

      onGoalCreated(newGoal);
      setGoalText('');
      setTargetDate('');
      onClose();
    } catch (err) {
      console.error(err);
      setError('Failed to generate plan. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9000,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 500, padding: 32,
              background: 'rgba(22,24,54,0.98)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 20,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>🎯 Set a Learning Goal</h2>
              <button onClick={onClose} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: 4,
              }}>
                <HiOutlineXMark size={22} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                  What&apos;s your goal?
                </label>
                <input
                  value={goalText}
                  onChange={e => setGoalText(e.target.value)}
                  placeholder="e.g., Crack a frontend internship"
                  className="glass-input"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Target date
                </label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={e => setTargetDate(e.target.value)}
                  className="glass-input"
                  style={{ width: '100%', colorScheme: 'dark' }}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Hours per day available
                </label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {[1, 2, 3, 4].map(h => (
                    <button
                      key={h}
                      onClick={() => setHoursPerDay(h)}
                      style={{
                        flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer',
                        background: hoursPerDay === h ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${hoursPerDay === h ? 'rgba(59,130,246,0.4)' : 'var(--border-subtle)'}`,
                        color: hoursPerDay === h ? '#3b82f6' : 'var(--text-secondary)',
                        fontFamily: 'inherit', fontWeight: 600, fontSize: '0.9rem',
                      }}
                    >
                      {h}{h === 4 ? '+' : ''}h
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '0.85rem' }}>
                  {error}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={loading || !goalText.trim() || !targetDate}
                className="btn-gradient"
                style={{
                  padding: '12px 24px', width: '100%',
                  opacity: loading || !goalText.trim() || !targetDate ? 0.5 : 1,
                  cursor: loading || !goalText.trim() || !targetDate ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {loading ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      style={{
                        width: 18, height: 18,
                        border: '2px solid rgba(255,255,255,0.3)',
                        borderTopColor: '#fff', borderRadius: '50%',
                      }}
                    />
                    AI is generating your plan...
                  </>
                ) : (
                  <>
                    <HiOutlineSparkles size={18} />
                    Generate AI Plan
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
