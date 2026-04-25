'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api, { QuizQuestion as QuizQuestionType } from '@/lib/api';
import { HiOutlineAcademicCap, HiOutlineCheckCircle, HiOutlineXCircle, HiOutlineSparkles, HiOutlineSpeakerWave, HiOutlineStop } from 'react-icons/hi2';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { useSpeech } from '@/hooks/useSpeech';
import QuizSettings, { Difficulty, QuestionCount, KnowledgeSource } from '@/components/QuizSettings';
import QuizQuestion from '@/components/QuizQuestion';
import PostQuizReview from '@/components/PostQuizReview';
import QuizAnalytics from '@/components/QuizAnalytics';
import PersonaSelector from '@/components/PersonaSelector';
import WeakAreasCard from '@/components/WeakAreasCard';
import { getUserProfile, updateUserProfile, QuizHistoryEntry } from '@/lib/userProfile';
import { logActivity } from '@/lib/streakTracker';
import { getPersonaPrompt, PERSONA_LABELS } from '@/lib/personaPrompts';
import { EXAMS, getDaysUntilExam, ExamInfo } from '@/lib/examData';
import { HR_QUESTIONS, TECHNICAL_QUESTIONS, TECHNICAL_ROLES } from '@/lib/interviewData';

export default function QuizPage() {
  const [topic, setTopic] = useState('');
  const [questions, setQuestions] = useState<QuizQuestionType[]>([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [questionCount, setQuestionCount] = useState<QuestionCount>(5);
  const [source, setSource] = useState<KnowledgeSource>('general');
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [quizComplete, setQuizComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [concept, setConcept] = useState('');
  const [explanation, setExplanation] = useState('');
  const [explaining, setExplaining] = useState(false);
  const { isSpeaking, speak, stop, supported } = useSpeech();
  const [focusMode, setFocusMode] = useState(false);
  const [weakTopics, setWeakTopics] = useState<{ topic: string; score: number; trend: 'up' | 'down' | 'stable' }[]>([]);
  const [activePersona, setActivePersona] = useState('friendlyGuide');

  // Exam Prep
  const [selectedExam, setSelectedExam] = useState<ExamInfo | null>(null);
  const [examDate, setExamDate] = useState('');
  const [examQuestions, setExamQuestions] = useState('');
  const [generatingExamQ, setGeneratingExamQ] = useState(false);

  // Interview Prep
  const [interviewTab, setInterviewTab] = useState<'hr' | 'technical' | 'mock'>('hr');
  const [interviewRole, setInterviewRole] = useState(TECHNICAL_ROLES[0]);
  const [selectedIQ, setSelectedIQ] = useState('');
  const [interviewAnswer, setInterviewAnswer] = useState('');
  const [interviewFeedback, setInterviewFeedback] = useState('');
  const [evaluatingAnswer, setEvaluatingAnswer] = useState(false);
  const [mockStep, setMockStep] = useState(0);
  const [mockAnswers, setMockAnswers] = useState<string[]>([]);
  const [mockFeedbacks, setMockFeedbacks] = useState<string[]>([]);
  const [mockComplete, setMockComplete] = useState(false);
  const [mockLoading, setMockLoading] = useState(false);
  const [bottomTab, setBottomTab] = useState<'exam' | 'interview'>('exam');

  useEffect(() => {
    logActivity('quiz_visit');
    const profile = getUserProfile();
    if (profile.persona) setActivePersona(profile.persona);
    if (profile.examMode) {
      const ex = EXAMS.find(e => e.name === profile.examMode?.exam);
      if (ex) setSelectedExam(ex);
      if (profile.examMode.examDate) setExamDate(profile.examMode.examDate);
    }
    const history = profile.quizHistory || [];
    const topicMap: Record<string, { scores: number[]; total: number }> = {};
    history.forEach(h => {
      if (!topicMap[h.topic]) topicMap[h.topic] = { scores: [], total: 0 };
      topicMap[h.topic].scores.push(Math.round((h.score / Math.max(h.total, 1)) * 100));
      topicMap[h.topic].total++;
    });
    const weak = Object.entries(topicMap)
      .map(([t, data]) => {
        const avg = Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length);
        const trend: 'up' | 'down' | 'stable' = data.scores.length >= 2
          ? data.scores[data.scores.length - 1] > data.scores[data.scores.length - 2] ? 'up' : data.scores[data.scores.length - 1] < data.scores[data.scores.length - 2] ? 'down' : 'stable'
          : 'stable';
        return { topic: t, score: avg, trend };
      })
      .filter(w => w.score < 70)
      .sort((a, b) => a.score - b.score);
    setWeakTopics(weak);
  }, []);

  const startQuiz = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    try {
      const res = await api.generateQuiz(topic, undefined, difficulty, questionCount, source === 'documents');
      setQuestions(res.quiz); setExplanation(res.explanation);
      setUserAnswers(new Array(res.quiz.length).fill(null));
      setCurrent(0); setSelected(null); setScore(0);
      setShowResult(false); setQuizComplete(false);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const selectAnswer = (idx: number) => {
    if (showResult) return;
    setSelected(idx); setShowResult(true);
    setUserAnswers(prev => { const u = [...prev]; u[current] = idx; return u; });
    if (idx !== -1 && questions[current].options[idx] === questions[current].correct) {
      setScore(s => s + 1);
    }
  };

  const nextQuestion = async () => {
    if (current < questions.length - 1) {
      setCurrent(c => c + 1); setSelected(null); setShowResult(false);
    } else {
      setQuizComplete(true);
      try {
        const finalScore = selected !== -1 && questions[current].options[selected as number] === questions[current].correct ? score + 1 : score;
        await api.saveQuizAttempt(topic, finalScore, questions.length, 0, difficulty);
        const profile = getUserProfile();
        const entry: QuizHistoryEntry = { topic, score: finalScore, total: questions.length, date: new Date().toISOString() };
        const history = [...(profile.quizHistory || []), entry];
        updateUserProfile({ quizHistory: history });
        logActivity('quiz_complete');
      } catch (e) { console.error("Failed to save quiz attempt:", e); }
    }
  };

  const explainConcept = async () => {
    if (!concept.trim()) return;
    setExplaining(true);
    try { const res = await api.explainConcept(concept, true); setExplanation(res.explanation); }
    catch (err) { console.error(err); }
    finally { setExplaining(false); }
  };

  // Exam Prep handlers
  const selectExam = (exam: ExamInfo) => {
    setSelectedExam(exam);
    updateUserProfile({ examMode: { exam: exam.name, examDate, subjects: exam.subjects.map(s => s.name) } });
  };
  const generateExamQuestions = async (subject: string) => {
    if (!selectedExam) return;
    setGeneratingExamQ(true); setExamQuestions('');
    try {
      const res = await api.queryAI(`Generate 5 practice questions for ${selectedExam.name} exam, subject: ${subject}. Include answers. Format with numbered questions and answers.`);
      setExamQuestions(res.answer || 'Could not generate.');
    } catch { setExamQuestions('Failed.'); }
    finally { setGeneratingExamQ(false); }
  };

  // Interview handlers
  const evaluateInterviewAnswer = async () => {
    if (!interviewAnswer.trim() || !selectedIQ) return;
    setEvaluatingAnswer(true);
    try {
      const res = await api.queryAI(`You are a technical interview coach. Evaluate:\nQuestion: ${selectedIQ}\nAnswer: ${interviewAnswer}\nGive: 1) Score/10, 2) What's good, 3) Improve, 4) Model answer.`);
      setInterviewFeedback(res.answer || 'Could not evaluate.');
    } catch { setInterviewFeedback('Failed.'); }
    finally { setEvaluatingAnswer(false); }
  };

  const MOCK_COUNT = 5;
  const startMock = () => { setMockStep(0); setMockAnswers([]); setMockFeedbacks([]); setMockComplete(false); setInterviewAnswer(''); };
  const getMockQ = () => {
    const techQs = TECHNICAL_QUESTIONS[interviewRole] || [];
    const combined = [...HR_QUESTIONS.slice(0, 2), ...techQs.slice(0, MOCK_COUNT - 2)];
    return combined[mockStep] || 'Tell me about a challenging project.';
  };
  const submitMockAnswer = async () => {
    if (!interviewAnswer.trim()) return;
    setMockLoading(true);
    setMockAnswers(prev => [...prev, interviewAnswer]);
    try {
      const res = await api.queryAI(`Interview coach: rate briefly. Q: "${getMockQ()}" A: "${interviewAnswer}"`);
      setMockFeedbacks(prev => [...prev, res.answer || 'Good attempt.']);
    } catch { setMockFeedbacks(prev => [...prev, 'Could not evaluate.']); }
    setInterviewAnswer('');
    if (mockStep >= MOCK_COUNT - 1) setMockComplete(true);
    else setMockStep(s => s + 1);
    setMockLoading(false);
  };

  const q = questions[current];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 4 }}>AI Tutor</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Quizzes, concept explanations, exam prep, and interview practice</p>
        </div>
        <PersonaSelector onChange={(p) => setActivePersona(p)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Quiz Section */}
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>📝 Quiz Generator</h2>
          <div className="glass-card" style={{ padding: 24, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <input value={topic} onChange={e => setTopic(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && startQuiz()}
                placeholder="Enter a topic for your quiz..." className="glass-input" style={{ flex: 1 }} />
              <button onClick={startQuiz} disabled={loading || !topic.trim()} className="btn-gradient"
                style={{ padding: '12px 20px', whiteSpace: 'nowrap' }}>{loading ? '...' : 'Start Quiz'}</button>
            </div>
          </div>
          <QuizSettings difficulty={difficulty} setDifficulty={setDifficulty}
            questionCount={questionCount} setQuestionCount={setQuestionCount}
            source={source} setSource={setSource} />
          {focusMode && weakTopics.length > 0 && (
            <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.1)' }}>
              <span style={{ fontSize: '0.78rem', color: '#fbbf24', fontWeight: 600 }}>🎯 Focus Mode:</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: 6 }}>Targeting: {weakTopics.slice(0, 3).map(w => w.topic).join(', ')}</span>
            </div>
          )}
          <WeakAreasCard weakTopics={weakTopics}
            onFocusQuiz={(t) => { setTopic(t); startQuiz(); }} />
          {q && !quizComplete && (
            <QuizQuestion question={q} currentNum={current + 1} totalNum={questions.length}
              selected={selected} showResult={showResult} score={score}
              onSelect={selectAnswer} onNext={nextQuestion} />
          )}
          {quizComplete && (
            <PostQuizReview questions={questions}
              userAnswers={userAnswers} topic={topic}
              onRetake={startQuiz}
              onNewTopic={() => { setQuestions([]); setTopic(''); setQuizComplete(false); }} />
          )}
        </div>

        {/* Explain Section */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>🧠 Concept Explainer</h2>
            {explanation && supported && (
              <button onClick={() => isSpeaking ? stop() : speak(explanation)} className="btn-gradient"
                style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6,
                  background: isSpeaking ? 'rgba(239,68,68,0.2)' : undefined,
                  border: isSpeaking ? '1px solid rgba(239,68,68,0.4)' : undefined,
                  color: isSpeaking ? '#f87171' : undefined }}>
                {isSpeaking ? (<><HiOutlineStop size={16} /> Stop</>) : (<><HiOutlineSpeakerWave size={16} /> Listen</>)}
              </button>
            )}
          </div>
          <div className="glass-card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <input value={concept} onChange={e => setConcept(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && explainConcept()}
                placeholder="Enter a concept to explain..." className="glass-input" style={{ flex: 1 }} />
              <button onClick={explainConcept} disabled={explaining || !concept.trim()} className="btn-gradient"
                style={{ padding: '12px 20px', whiteSpace: 'nowrap' }}>{explaining ? '...' : 'Explain'}</button>
            </div>
            {explanation && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ padding: 16, borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)' }}>
                <MarkdownRenderer content={explanation} />
              </motion.div>
            )}
            {!explanation && !explaining && (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                <HiOutlineSparkles size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                <p style={{ fontSize: '0.9rem' }}>Ask AI to explain any concept</p>
              </div>
            )}
          </div>
          <div style={{ marginTop: 24 }}><QuizAnalytics /></div>
        </div>
      </div>

      {/* ── BOTTOM: EXAM PREP + INTERVIEW PREP ── */}
      <div style={{ marginTop: 32 }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
          {[{ key: 'exam' as const, label: '📚 Exam Prep', color: '#f59e0b' }, { key: 'interview' as const, label: '💼 Interview Prep', color: '#8b5cf6' }].map(tab => (
            <button key={tab.key} onClick={() => setBottomTab(tab.key)}
              style={{
                padding: '10px 20px', borderRadius: '10px 10px 0 0', border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: '0.9rem', fontWeight: 600,
                background: bottomTab === tab.key ? 'rgba(255,255,255,0.04)' : 'transparent',
                color: bottomTab === tab.key ? tab.color : 'var(--text-muted)',
                borderBottom: bottomTab === tab.key ? `2px solid ${tab.color}` : '2px solid transparent',
              }}>{tab.label}</button>
          ))}
        </div>

        {/* EXAM PREP */}
        {bottomTab === 'exam' && (
          <div className="glass-card" style={{ padding: 24 }}>
            {!selectedExam ? (
              <>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>Select Your Exam</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  {EXAMS.map(exam => (
                    <button key={exam.name} onClick={() => selectExam(exam)}
                      style={{ padding: 16, borderRadius: 12, cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit',
                        background: `${exam.color}08`, border: `1px solid ${exam.color}20`, transition: 'all 0.15s' }}
                      onMouseOver={e => { e.currentTarget.style.background = `${exam.color}15`; }}
                      onMouseOut={e => { e.currentTarget.style.background = `${exam.color}08`; }}>
                      <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>{exam.icon}</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: exam.color }}>{exam.name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>{exam.subjects.length} subjects</div>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{selectedExam.icon} {selectedExam.name}</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{selectedExam.description}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <input type="date" value={examDate} onChange={e => { setExamDate(e.target.value); updateUserProfile({ examMode: { exam: selectedExam.name, examDate: e.target.value, subjects: selectedExam.subjects.map(s => s.name) } }); }}
                      className="glass-input" style={{ fontSize: '0.8rem' }} />
                    {examDate && (
                      <div style={{ padding: '6px 12px', borderRadius: 8, background: getDaysUntilExam(examDate) <= 30 ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', fontSize: '0.8rem', fontWeight: 600, color: getDaysUntilExam(examDate) <= 30 ? '#f87171' : '#6ee7b7', whiteSpace: 'nowrap' }}>
                        ⏱️ {getDaysUntilExam(examDate)} days left
                      </div>
                    )}
                    <button onClick={() => setSelectedExam(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.78rem', fontFamily: 'inherit' }}>Change</button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                  {selectedExam.subjects.map(sub => (
                    <div key={sub.name} style={{ padding: 16, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{sub.name}</span>
                        <span style={{ fontSize: '0.75rem', color: selectedExam.color, fontWeight: 600 }}>{sub.weightage}%</span>
                      </div>
                      <div style={{ height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.06)', marginBottom: 10 }}>
                        <div style={{ height: '100%', borderRadius: 4, width: `${sub.weightage}%`, background: selectedExam.color }} />
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                        {sub.topics.slice(0, 4).map(t => (
                          <span key={t} style={{ padding: '2px 6px', borderRadius: 4, fontSize: '0.65rem', background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)' }}>{t}</span>
                        ))}
                        {sub.topics.length > 4 && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>+{sub.topics.length - 4}</span>}
                      </div>
                      <button onClick={() => generateExamQuestions(sub.name)} disabled={generatingExamQ}
                        style={{ width: '100%', padding: 6, borderRadius: 6, border: `1px solid ${selectedExam.color}30`, background: `${selectedExam.color}08`, color: selectedExam.color, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {generatingExamQ ? '...' : 'Practice Questions →'}
                      </button>
                    </div>
                  ))}
                </div>
                {examQuestions && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginTop: 16, padding: 16, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <MarkdownRenderer content={examQuestions} />
                  </motion.div>
                )}
              </>
            )}
          </div>
        )}

        {/* INTERVIEW PREP */}
        {bottomTab === 'interview' && (
          <div className="glass-card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
              {[{ key: 'hr' as const, label: 'HR Questions' }, { key: 'technical' as const, label: 'Technical' }, { key: 'mock' as const, label: 'Mock Interview' }].map(t => (
                <button key={t.key} onClick={() => setInterviewTab(t.key)}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 500,
                    background: interviewTab === t.key ? 'rgba(139,92,246,0.12)' : 'transparent',
                    color: interviewTab === t.key ? '#a78bfa' : 'var(--text-muted)' }}>{t.label}</button>
              ))}
              {(interviewTab === 'technical' || interviewTab === 'mock') && (
                <select value={interviewRole} onChange={e => setInterviewRole(e.target.value)}
                  className="glass-input" style={{ marginLeft: 'auto', fontSize: '0.8rem', padding: '6px 10px' }}>
                  {TECHNICAL_ROLES.map(r => <option key={r} value={r} style={{ background: '#161836' }}>{r}</option>)}
                </select>
              )}
            </div>

            {/* HR / Technical */}
            {(interviewTab === 'hr' || interviewTab === 'technical') && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ maxHeight: 350, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {(interviewTab === 'hr' ? HR_QUESTIONS : (TECHNICAL_QUESTIONS[interviewRole] || [])).map((iq, i) => (
                    <button key={i} onClick={() => { setSelectedIQ(iq); setInterviewFeedback(''); setInterviewAnswer(''); }}
                      style={{ padding: '10px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', fontSize: '0.8rem',
                        background: selectedIQ === iq ? 'rgba(139,92,246,0.1)' : 'transparent',
                        color: selectedIQ === iq ? '#a78bfa' : 'var(--text-secondary)' }}>
                      <span style={{ color: 'var(--text-muted)', marginRight: 8, fontSize: '0.72rem' }}>{i + 1}.</span>{iq}
                    </button>
                  ))}
                </div>
                <div>
                  {selectedIQ ? (
                    <>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 12, color: '#a78bfa' }}>{selectedIQ}</div>
                      <textarea value={interviewAnswer} onChange={e => setInterviewAnswer(e.target.value)}
                        placeholder="Type your answer here..." rows={5}
                        style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 12, color: 'var(--text-primary)', fontSize: '0.85rem', fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />
                      <button onClick={evaluateInterviewAnswer} disabled={evaluatingAnswer || !interviewAnswer.trim()}
                        className="btn-gradient" style={{ marginTop: 10, padding: '10px 20px', fontSize: '0.85rem' }}>
                        {evaluatingAnswer ? 'Evaluating...' : 'Get AI Feedback'}
                      </button>
                      {interviewFeedback && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginTop: 12, padding: 14, borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <MarkdownRenderer content={interviewFeedback} />
                        </motion.div>
                      )}
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: '0.85rem' }}>← Select a question to practice</div>
                  )}
                </div>
              </div>
            )}

            {/* Mock Interview */}
            {interviewTab === 'mock' && (
              <div style={{ maxWidth: 600, margin: '0 auto' }}>
                {!mockComplete ? (
                  <>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>Question {mockStep + 1} of {MOCK_COUNT}</div>
                    <div style={{ height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.06)', marginBottom: 16 }}>
                      <div style={{ height: '100%', borderRadius: 4, width: `${((mockStep + 1) / MOCK_COUNT) * 100}%`, background: '#8b5cf6', transition: 'width 0.3s' }} />
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16, color: '#a78bfa' }}>{getMockQ()}</div>
                    <textarea value={interviewAnswer} onChange={e => setInterviewAnswer(e.target.value)} placeholder="Type your answer..." rows={4}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 12, color: 'var(--text-primary)', fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none', resize: 'vertical' }} />
                    <button onClick={submitMockAnswer} disabled={mockLoading || !interviewAnswer.trim()}
                      className="btn-gradient" style={{ marginTop: 12, padding: '10px 24px', fontSize: '0.85rem' }}>
                      {mockLoading ? 'Evaluating...' : mockStep < MOCK_COUNT - 1 ? 'Next Question' : 'Finish Interview'}
                    </button>
                  </>
                ) : (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🎉</div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 16 }}>Mock Interview Complete!</h3>
                    <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                      {mockAnswers.map((a, i) => (
                        <div key={i} style={{ padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ fontSize: '0.78rem', color: '#a78bfa', fontWeight: 600, marginBottom: 4 }}>Q{i + 1}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 4 }}>Your answer: {a.slice(0, 120)}...</div>
                          {mockFeedbacks[i] && <div style={{ fontSize: '0.78rem', color: '#6ee7b7' }}>💡 {mockFeedbacks[i]}</div>}
                        </div>
                      ))}
                    </div>
                    <button onClick={startMock} className="btn-gradient" style={{ padding: '10px 24px' }}>Retake Interview</button>
                  </motion.div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
