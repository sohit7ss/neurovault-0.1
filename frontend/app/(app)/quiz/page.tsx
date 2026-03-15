'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api, { QuizQuestion as QuizQuestionType } from '@/lib/api';
import { HiOutlineAcademicCap, HiOutlineCheckCircle, HiOutlineXCircle, HiOutlineSparkles, HiOutlineSpeakerWave, HiOutlineStop } from 'react-icons/hi2';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { useSpeech } from '@/hooks/useSpeech';
import QuizSettings, { Difficulty, QuestionCount, KnowledgeSource } from '@/components/QuizSettings';
import QuizQuestion from '@/components/QuizQuestion';
import PostQuizReview from '@/components/PostQuizReview';
import QuizAnalytics from '@/components/QuizAnalytics';

export default function QuizPage() {
  const [topic, setTopic] = useState('');
  const [questions, setQuestions] = useState<QuizQuestionType[]>([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>([]);
  
  // Quiz Settings State
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

  const startQuiz = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    try {
      const res = await api.generateQuiz(topic, undefined, difficulty, questionCount, source === 'documents');
      setQuestions(res.quiz);
      setExplanation(res.explanation);
      setUserAnswers(new Array(res.quiz.length).fill(null));
      setCurrent(0); setSelected(null); setScore(0);
      setShowResult(false); setQuizComplete(false);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const selectAnswer = (idx: number) => {
    if (showResult) return;
    setSelected(idx);
    setShowResult(true);
    
    setUserAnswers(prev => {
      const updated = [...prev];
      updated[current] = idx;
      return updated;
    });

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
      } catch (e) {
        console.error("Failed to save quiz attempt:", e);
      }
    }
  };

  const explainConcept = async () => {
    if (!concept.trim()) return;
    setExplaining(true);
    try {
      const res = await api.explainConcept(concept, true);
      setExplanation(res.explanation);
    } catch (err) { console.error(err); }
    finally { setExplaining(false); }
  };

  const q = questions[current];
  const pct = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 4 }}>AI Tutor</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Test your knowledge with AI-generated quizzes and get concept explanations
        </p>
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
                style={{ padding: '12px 20px', whiteSpace: 'nowrap' }}>
                {loading ? '...' : 'Start Quiz'}
              </button>
            </div>
          </div>
          
          <QuizSettings
            difficulty={difficulty} setDifficulty={setDifficulty}
            questionCount={questionCount} setQuestionCount={setQuestionCount}
            source={source} setSource={setSource}
          />

          {questions.length > 0 && !quizComplete && q && (
            <QuizQuestion 
              question={q}
              currentNum={current + 1}
              totalNum={questions.length}
              selected={selected}
              showResult={showResult}
              score={score}
              onSelect={selectAnswer}
              onNext={nextQuestion}
            />
          )}

          {quizComplete && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="glass-card" style={{ padding: 32, textAlign: 'center' }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%', margin: '0 auto 20px',
                background: pct >= 80 ? 'rgba(16,185,129,0.15)' : pct >= 50 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '2rem',
              }}>
                {pct >= 80 ? '🏆' : pct >= 50 ? '👍' : '📚'}
              </div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 4 }}>Quiz Complete!</h3>
              <div style={{
                fontSize: '2rem', fontWeight: 800, marginBottom: 8,
                background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                {score}/{questions.length} ({pct}%)
              </div>
              <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
                {pct >= 80 ? 'Excellent!' : pct >= 50 ? 'Good effort!' : 'Keep studying!'}
              </p>
              
              {explanation && (
                <div style={{
                  padding: '20px', borderRadius: 12, marginBottom: 20, textAlign: 'left',
                  background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)',
                  fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.6,
                }}>
                  <h4 style={{ color: 'var(--text-primary)', marginBottom: 8, fontSize: '1.05rem' }}>Concept Overview</h4>
                  <MarkdownRenderer content={explanation} />
                </div>
              )}

              <button onClick={() => { setQuestions([]); setQuizComplete(false); }} className="btn-gradient"
                style={{ padding: '10px 24px' }}>
                Try Another Quiz
              </button>
            </motion.div>
          )}

          {quizComplete && (
            <PostQuizReview 
              questions={questions}
              userAnswers={userAnswers}
              topic={topic}
              onRetake={startQuiz}
              onNewTopic={() => { setQuestions([]); setTopic(''); setQuizComplete(false); }}
            />
          )}
        </div>


        {/* Explain Section */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>🧠 Concept Explainer</h2>
            {explanation && supported && (
              <button 
                onClick={() => isSpeaking ? stop() : speak(explanation)}
                className="btn-gradient"
                style={{
                  padding: '6px 12px',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: isSpeaking ? 'rgba(239, 68, 68, 0.2)' : undefined,
                  border: isSpeaking ? '1px solid rgba(239, 68, 68, 0.4)' : undefined,
                  color: isSpeaking ? '#f87171' : undefined
                }}
              >
                {isSpeaking ? (
                  <><HiOutlineStop size={16} /> Stop</>
                ) : (
                  <><HiOutlineSpeakerWave size={16} className={isSpeaking ? 'pulse-anim' : ''} /> Listen</>
                )}
              </button>
            )}
          </div>
          <div className="glass-card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <input value={concept} onChange={e => setConcept(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && explainConcept()}
                placeholder="Enter a concept to explain..." className="glass-input" style={{ flex: 1 }} />
              <button onClick={explainConcept} disabled={explaining || !concept.trim()} className="btn-gradient"
                style={{ padding: '12px 20px', whiteSpace: 'nowrap' }}>
                {explaining ? '...' : 'Explain'}
              </button>
            </div>
            {explanation && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{
                  padding: '16px', borderRadius: 12,
                  background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)',
                }}>
                <MarkdownRenderer content={explanation} />
              </motion.div>
            )}
            {!explanation && !explaining && (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                <HiOutlineSparkles size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                <p style={{ fontSize: '0.9rem' }}>Ask AI to explain any concept</p>
                <p style={{ fontSize: '0.8rem', marginTop: 4 }}>Uses your documents for context</p>
              </div>
            )}
          </div>
          
          <div style={{ marginTop: 24 }}>
            <QuizAnalytics />
          </div>
        </div>
      </div>
    </div>
  );
}
