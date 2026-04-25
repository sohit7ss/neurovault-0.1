'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getUserProfile, updateUserProfile } from '@/lib/userProfile';
import { CAREER_PATHS } from '@/lib/careerData';
import { logActivity } from '@/lib/streakTracker';
import api from '@/lib/api';
import Link from 'next/link';
import { HiOutlineSparkles, HiOutlineRocketLaunch, HiOutlineArrowRight } from 'react-icons/hi2';

interface QuizQ {
  id: number;
  question: string;
  type: 'choice' | 'scale' | 'dropdown' | 'select';
  options?: string[];
  scaleLabels?: [string, string];
}

const QUESTIONS: QuizQ[] = [
  { id: 1, question: 'Do you prefer building things or analyzing data?', type: 'choice', options: ['Building things', 'Analyzing data', 'Both equally'] },
  { id: 2, question: 'Are you comfortable with mathematics?', type: 'scale', scaleLabels: ['Not at all', 'Love it'] },
  { id: 3, question: 'Do you enjoy designing user interfaces?', type: 'choice', options: ['Yes, I love design', 'Somewhat', 'Not really'] },
  { id: 4, question: 'How do you feel about managing servers and infrastructure?', type: 'choice', options: ['Excited by it', 'Neutral', 'Prefer to avoid it'] },
  { id: 5, question: 'Do you enjoy finding and fixing security vulnerabilities?', type: 'choice', options: ['Yes, it\'s thrilling', 'It\'s interesting', 'Not my thing'] },
  { id: 6, question: 'Are you interested in teaching machines to learn?', type: 'choice', options: ['Absolutely', 'Curious about it', 'Not interested'] },
  { id: 7, question: 'Do you prefer working alone or in teams?', type: 'choice', options: ['Solo work', 'Team work', 'Mix of both'] },
  { id: 8, question: 'What\'s your current strongest skill?', type: 'dropdown', options: ['Programming', 'Mathematics', 'Design/UI', 'Problem Solving', 'Communication', 'Research', 'None yet'] },
  { id: 9, question: 'How many hours per day can you realistically study?', type: 'choice', options: ['1-2 hours', '2-4 hours', '4+ hours'] },
  { id: 10, question: 'What\'s your target timeline to get a job?', type: 'choice', options: ['3 months', '6 months', '1 year', '2 years'] },
];

export default function CareerMatchPage() {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string | number>>({});
  const [phase, setPhase] = useState<'quiz' | 'analyzing' | 'results'>('quiz');
  const [results, setResults] = useState<{ career: string; percentage: number; reason: string }[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    logActivity('career_match_visit');
    const profile = getUserProfile();
    if (profile.careerMatchResult) {
      setResults(profile.careerMatchResult.top3);
      setPhase('results');
    }
    setMounted(true);
  }, []);

  const setAnswer = (val: string | number) => {
    setAnswers(prev => ({ ...prev, [QUESTIONS[current].id]: val }));
  };

  const next = () => {
    if (current < QUESTIONS.length - 1) {
      setCurrent(c => c + 1);
    } else {
      analyzeResults();
    }
  };

  const prev = () => { if (current > 0) setCurrent(c => c - 1); };

  const analyzeResults = async () => {
    setPhase('analyzing');
    try {
      const answersText = QUESTIONS.map(q => `Q: ${q.question} — A: ${answers[q.id] || 'No answer'}`).join('\n');
      const careers = Object.keys(CAREER_PATHS).join(', ');
      const prompt = `Based on these career aptitude quiz answers, recommend the top 3 best-fit careers from: ${careers}.

Answers:
${answersText}

Return ONLY valid JSON (no markdown), in this format:
[{"career":"ML Engineer","percentage":87,"reason":"Strong math interest and desire to teach machines to learn align perfectly"},{"career":"Data Scientist","percentage":74,"reason":"Data analysis interest combined with math skills"},{"career":"Backend Developer","percentage":68,"reason":"Enjoys building and problem solving"}]

Percentages should be realistic (60-95 range). Reasons should be 1 sentence each.`;

      const res = await api.queryAI(prompt);
      let text = res.answer;
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { career: string; percentage: number; reason: string }[];
        const top3 = parsed.slice(0, 3);
        setResults(top3);
        updateUserProfile({
          careerMatchResult: {
            career: top3[0].career,
            percentage: top3[0].percentage,
            top3,
            date: new Date().toISOString(),
          },
        });
        setPhase('results');
      }
    } catch {
      // Fallback
      const fallback = [
        { career: 'Frontend Developer', percentage: 78, reason: 'Based on your interest in building and design' },
        { career: 'Backend Developer', percentage: 72, reason: 'Strong problem-solving orientation' },
        { career: 'Data Scientist', percentage: 65, reason: 'Curiosity about data and analysis' },
      ];
      setResults(fallback);
      updateUserProfile({ careerMatchResult: { career: fallback[0].career, percentage: fallback[0].percentage, top3: fallback, date: new Date().toISOString() } });
      setPhase('results');
    }
  };

  const retake = () => {
    setPhase('quiz');
    setCurrent(0);
    setAnswers({});
    setResults([]);
    updateUserProfile({ careerMatchResult: null });
  };

  const selectCareer = (career: string) => {
    updateUserProfile({ careerGoal: career });
  };

  if (!mounted) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;

  const q = QUESTIONS[current];
  const progress = ((current + 1) / QUESTIONS.length) * 100;

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <div style={{ marginBottom: 28, textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 4 }}>Find My Career Path</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Answer 10 questions and AI will match you with the best career
        </p>
      </div>

      <AnimatePresence mode="wait">
        {/* QUIZ PHASE */}
        {phase === 'quiz' && (
          <motion.div key="quiz" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
            {/* Progress */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                <span>Question {current + 1} of {QUESTIONS.length}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div style={{ height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.06)' }}>
                <div style={{ height: '100%', borderRadius: 4, width: `${progress}%`, background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)', transition: 'width 0.3s' }} />
              </div>
            </div>

            <div className="glass-card" style={{ padding: 32 }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: 24, lineHeight: 1.5 }}>{q.question}</h2>

              {q.type === 'choice' && q.options?.map(opt => (
                <button key={opt} onClick={() => setAnswer(opt)}
                  style={{
                    display: 'block', width: '100%', padding: '14px 18px', marginBottom: 8, borderRadius: 10,
                    border: `1px solid ${answers[q.id] === opt ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    background: answers[q.id] === opt ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.02)',
                    color: answers[q.id] === opt ? '#a5b4fc' : 'var(--text-secondary)',
                    cursor: 'pointer', textAlign: 'left', fontSize: '0.9rem', fontFamily: 'inherit',
                    transition: 'all 0.15s',
                  }}>{opt}</button>
              ))}

              {q.type === 'scale' && (
                <div style={{ padding: '10px 0' }}>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 12 }}>
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n} onClick={() => setAnswer(n)}
                        style={{
                          width: 48, height: 48, borderRadius: 12, fontSize: '1.1rem', fontWeight: 700,
                          border: `2px solid ${answers[q.id] === n ? '#818cf8' : 'rgba(255,255,255,0.1)'}`,
                          background: answers[q.id] === n ? 'rgba(99,102,241,0.15)' : 'transparent',
                          color: answers[q.id] === n ? '#a5b4fc' : 'var(--text-muted)',
                          cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                        }}>{n}</button>
                    ))}
                  </div>
                  {q.scaleLabels && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span>{q.scaleLabels[0]}</span><span>{q.scaleLabels[1]}</span>
                    </div>
                  )}
                </div>
              )}

              {q.type === 'dropdown' && (
                <select value={(answers[q.id] as string) || ''} onChange={e => setAnswer(e.target.value)}
                  className="glass-input" style={{ width: '100%', fontSize: '0.95rem' }}>
                  <option value="" style={{ background: '#161836' }}>Select...</option>
                  {q.options?.map(opt => (
                    <option key={opt} value={opt} style={{ background: '#161836' }}>{opt}</option>
                  ))}
                </select>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, gap: 12 }}>
                <button onClick={prev} disabled={current === 0}
                  style={{ padding: '10px 20px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', cursor: current === 0 ? 'not-allowed' : 'pointer', opacity: current === 0 ? 0.3 : 1, fontFamily: 'inherit', fontSize: '0.85rem' }}>
                  Back
                </button>
                <button onClick={next} disabled={!answers[q.id]}
                  className="btn-gradient" style={{ padding: '10px 24px', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600, cursor: answers[q.id] ? 'pointer' : 'not-allowed', opacity: answers[q.id] ? 1 : 0.4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {current < QUESTIONS.length - 1 ? 'Next' : 'Find My Match'} <HiOutlineArrowRight size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ANALYZING PHASE */}
        {phase === 'analyzing' && (
          <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', padding: 60 }}>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              style={{ width: 60, height: 60, margin: '0 auto 20px', borderRadius: '50%', border: '3px solid rgba(99,102,241,0.2)', borderTopColor: '#818cf8' }} />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: 8 }}>AI is analyzing your answers...</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Matching your traits against 8 career paths</p>
          </motion.div>
        )}

        {/* RESULTS PHASE */}
        {phase === 'results' && results.length > 0 && (
          <motion.div key="results" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>🎯</div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 6 }}>Your Career Matches</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Based on your answers, here are your top career fits</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {results.map((r, i) => {
                const cd = CAREER_PATHS[r.career];
                const colors = ['#8b5cf6', '#3b82f6', '#06b6d4'];
                const medals = ['🥇', '🥈', '🥉'];
                return (
                  <motion.div key={r.career} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.15 }}
                    className="glass-card" style={{
                      padding: 24, border: i === 0 ? '1px solid rgba(139,92,246,0.3)' : undefined,
                      background: i === 0 ? 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(59,130,246,0.04))' : undefined,
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                      <span style={{ fontSize: '1.5rem' }}>{medals[i]}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{r.career}</div>
                        {cd && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{cd.description}</div>}
                      </div>
                      <div style={{
                        fontSize: '1.5rem', fontWeight: 800, color: colors[i],
                      }}>{r.percentage}%</div>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.6 }}>
                      {r.reason}
                    </p>
                    {cd && (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                        {cd.requiredSkills.slice(0, 5).map(s => (
                          <span key={s} style={{ padding: '3px 8px', borderRadius: 4, fontSize: '0.7rem', background: `${colors[i]}12`, color: colors[i] }}>{s}</span>
                        ))}
                      </div>
                    )}
                    <Link href="/career" onClick={() => selectCareer(r.career)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                        borderRadius: 8, background: `${colors[i]}15`, border: `1px solid ${colors[i]}30`,
                        color: colors[i], fontSize: '0.82rem', fontWeight: 600, textDecoration: 'none',
                      }}>
                      <HiOutlineRocketLaunch size={14} /> Start This Career Path
                    </Link>
                  </motion.div>
                );
              })}
            </div>

            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <button onClick={retake} style={{
                padding: '8px 20px', borderRadius: 8, background: 'none',
                border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)',
                cursor: 'pointer', fontSize: '0.82rem', fontFamily: 'inherit',
              }}>Retake Quiz</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
