'use client';

import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { getUserProfile, updateUserProfile, StudyPlan } from '@/lib/userProfile';
import { logActivity } from '@/lib/streakTracker';
import api from '@/lib/api';
import { toPng } from 'html-to-image';
import {
  HiOutlineClock, HiOutlineCalendarDays, HiOutlineSparkles,
  HiOutlineArrowDownTray, HiOutlineTrash, HiOutlinePlusCircle,
} from 'react-icons/hi2';

const SUBJECT_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#f97316'];

export default function PlannerPage() {
  const [mounted, setMounted] = useState(false);
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [generating, setGenerating] = useState(false);

  // Form state
  const [weekdayHours, setWeekdayHours] = useState(2);
  const [weekendHours, setWeekendHours] = useState(4);
  const [subjects, setSubjects] = useState<{ name: string; level: string }[]>([{ name: '', level: 'Beginner' }]);
  const [targetDate, setTargetDate] = useState('');

  const calendarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logActivity('planner_visit');
    const profile = getUserProfile();
    if (profile.studyPlan) {
      setPlan(profile.studyPlan);
      setWeekdayHours(profile.studyPlan.weekdayHours);
      setWeekendHours(profile.studyPlan.weekendHours);
      setSubjects(profile.studyPlan.subjects);
      setTargetDate(profile.studyPlan.targetDate);
    }
    setMounted(true);
  }, []);

  const addSubject = () => setSubjects(prev => [...prev, { name: '', level: 'Beginner' }]);
  const removeSubject = (i: number) => setSubjects(prev => prev.filter((_, idx) => idx !== i));
  const updateSubject = (i: number, field: 'name' | 'level', val: string) => {
    setSubjects(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
  };

  const generatePlan = async () => {
    const validSubjects = subjects.filter(s => s.name.trim());
    if (validSubjects.length === 0 || !targetDate) return;

    setGenerating(true);
    try {
      const prompt = `Generate a structured study timetable as JSON. 
Input: Subjects: ${validSubjects.map(s => `${s.name} (${s.level})`).join(', ')}. 
Weekday study hours: ${weekdayHours}hrs. Weekend study hours: ${weekendHours}hrs. 
Target date: ${targetDate}. Today: ${new Date().toISOString().split('T')[0]}.

Return ONLY valid JSON in this format (no markdown, no explanation):
{"weeks":[{"week":1,"days":[{"day":"Mon","slots":[{"subject":"Math","hours":2}]},{"day":"Tue","slots":[{"subject":"Physics","hours":1.5}]}]}]}

Rules: 
- Alternate subjects daily for variety
- Fundamentals first for beginner subjects
- Include revision week before target date
- Keep it 4-8 weeks max
- Days are Mon,Tue,Wed,Thu,Fri,Sat,Sun`;

      const res = await api.queryAI(prompt);
      let text = res.answer;
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const newPlan: StudyPlan = {
          weekdayHours, weekendHours, subjects: validSubjects, targetDate,
          timetable: parsed.weeks || [],
          createdAt: new Date().toISOString(),
        };
        setPlan(newPlan);
        updateUserProfile({ studyPlan: newPlan });
      }
    } catch {
      // Generate a simple fallback plan
      const weeks = [];
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const validSubs = subjects.filter(s => s.name.trim());
      for (let w = 1; w <= 4; w++) {
        const weekDays = days.map((day, di) => {
          const isWeekend = di >= 5;
          const hrs = isWeekend ? weekendHours : weekdayHours;
          const perSubject = hrs / validSubs.length;
          return {
            day,
            slots: validSubs.map((s, si) => ({
              subject: s.name,
              hours: Math.round(perSubject * 10) / 10,
            })),
          };
        });
        weeks.push({ week: w, days: weekDays });
      }
      const newPlan: StudyPlan = {
        weekdayHours, weekendHours, subjects: validSubs, targetDate,
        timetable: weeks, createdAt: new Date().toISOString(),
      };
      setPlan(newPlan);
      updateUserProfile({ studyPlan: newPlan });
    } finally {
      setGenerating(false);
    }
  };

  const clearPlan = () => {
    setPlan(null);
    updateUserProfile({ studyPlan: null });
  };

  const exportImage = async () => {
    if (!calendarRef.current) return;
    try {
      const dataUrl = await toPng(calendarRef.current, { backgroundColor: '#0a0b1a' });
      const link = document.createElement('a');
      link.download = 'study-plan.png';
      link.href = dataUrl;
      link.click();
    } catch { /* ignore */ }
  };

  const getSubjectColor = (name: string) => {
    const validSubs = subjects.filter(s => s.name.trim());
    const idx = validSubs.findIndex(s => s.name === name);
    return SUBJECT_COLORS[idx % SUBJECT_COLORS.length];
  };

  if (!mounted) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 4 }}>Study Planner</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          AI generates a personalized study timetable based on your goals
        </p>
      </div>

      {/* Input Form */}
      <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>📝 Study Configuration</h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6 }}>
              <HiOutlineClock size={14} style={{ display: 'inline', marginRight: 4 }} /> Weekday Hours
            </label>
            <input type="number" min={0.5} max={12} step={0.5} value={weekdayHours}
              onChange={e => setWeekdayHours(+e.target.value)} className="glass-input"
              style={{ width: '100%', fontSize: '1rem', fontWeight: 600 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6 }}>
              <HiOutlineClock size={14} style={{ display: 'inline', marginRight: 4 }} /> Weekend Hours
            </label>
            <input type="number" min={0.5} max={12} step={0.5} value={weekendHours}
              onChange={e => setWeekendHours(+e.target.value)} className="glass-input"
              style={{ width: '100%', fontSize: '1rem', fontWeight: 600 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6 }}>
              <HiOutlineCalendarDays size={14} style={{ display: 'inline', marginRight: 4 }} /> Target Date
            </label>
            <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)}
              className="glass-input" style={{ width: '100%', fontSize: '0.9rem' }} />
          </div>
        </div>

        {/* Subjects */}
        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>Subjects / Topics</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {subjects.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 8 }}>
              <input value={s.name} onChange={e => updateSubject(i, 'name', e.target.value)}
                placeholder="Subject name" className="glass-input" style={{ flex: 1 }} />
              <select value={s.level} onChange={e => updateSubject(i, 'level', e.target.value)}
                className="glass-input" style={{ width: 140 }}>
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </select>
              {subjects.length > 1 && (
                <button onClick={() => removeSubject(i)} style={{
                  background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 6,
                }}><HiOutlineTrash size={16} /></button>
              )}
            </div>
          ))}
          <button onClick={addSubject} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8,
            background: 'none', border: '1px dashed rgba(255,255,255,0.1)', color: 'var(--text-muted)',
            cursor: 'pointer', fontSize: '0.82rem', fontFamily: 'inherit',
          }}><HiOutlinePlusCircle size={16} /> Add Subject</button>
        </div>

        <button onClick={generatePlan} disabled={generating || !targetDate || subjects.every(s => !s.name.trim())}
          className="btn-gradient" style={{
            padding: '12px 28px', borderRadius: 10, fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
            opacity: generating ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 8,
          }}>
          <HiOutlineSparkles size={18} />
          {generating ? 'Generating...' : 'Generate Study Plan'}
        </button>
      </div>

      {/* Generated Timetable */}
      {plan && plan.timetable.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>📅 Your Study Timetable</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={exportImage} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8,
                background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)',
                color: '#93c5fd', cursor: 'pointer', fontSize: '0.78rem', fontFamily: 'inherit',
              }}><HiOutlineArrowDownTray size={14} /> Export PNG</button>
              <button onClick={clearPlan} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8,
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                color: '#fca5a5', cursor: 'pointer', fontSize: '0.78rem', fontFamily: 'inherit',
              }}><HiOutlineTrash size={14} /> Clear</button>
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            {subjects.filter(s => s.name.trim()).map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem' }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: SUBJECT_COLORS[i % SUBJECT_COLORS.length] }} />
                <span style={{ color: 'var(--text-secondary)' }}>{s.name}</span>
              </div>
            ))}
          </div>

          <div ref={calendarRef} className="glass-card" style={{ padding: 20, overflowX: 'auto' }}>
            {plan.timetable.map((week, wi) => (
              <div key={wi} style={{ marginBottom: wi < plan.timetable.length - 1 ? 20 : 0 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#818cf8', marginBottom: 10 }}>
                  Week {week.week}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                  {week.days.map((day, di) => (
                    <div key={di} style={{
                      background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: 10,
                      border: '1px solid rgba(255,255,255,0.04)', minHeight: 80,
                    }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                        {day.day}
                      </div>
                      {day.slots.map((slot, si) => (
                        <div key={si} style={{
                          display: 'flex', alignItems: 'center', gap: 4, padding: '3px 6px',
                          borderRadius: 4, marginBottom: 3, fontSize: '0.7rem',
                          background: `${getSubjectColor(slot.subject)}15`,
                          color: getSubjectColor(slot.subject),
                        }}>
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {slot.subject}
                          </span>
                          <span style={{ fontWeight: 600, flexShrink: 0 }}>{slot.hours}h</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
