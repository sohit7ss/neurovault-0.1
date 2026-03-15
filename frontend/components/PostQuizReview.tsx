import { useState } from 'react';
import { motion } from 'framer-motion';
import { QuizQuestion } from '@/lib/api';
import { HiOutlineCheckCircle, HiOutlineXCircle, HiOutlineInformationCircle, HiOutlineChatBubbleLeftRight } from 'react-icons/hi2';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import api from '@/lib/api';

interface PostQuizReviewProps {
  questions: QuizQuestion[];
  userAnswers: (number | null)[];
  topic: string;
  onRetake: () => void;
  onNewTopic: () => void;
}

export default function PostQuizReview({ questions, userAnswers, topic, onRetake, onNewTopic }: PostQuizReviewProps) {
  const [followupQ, setFollowupQ] = useState('');
  const [followupA, setFollowupA] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFollowup = async () => {
    if (!followupQ.trim()) return;
    setLoading(true);
    setFollowupA('');
    try {
      const wrongContext = questions.map((q, i) => {
        const uIdx = userAnswers[i];
        if (uIdx !== null && uIdx !== -1 && q.options[uIdx] !== q.correct) {
          return `Q: ${q.question} | User picked: ${q.options[uIdx]} | Correct: ${q.correct}`;
        }
        return null;
      }).filter(Boolean);

      const res = await api.tutorFollowup(topic, followupQ, wrongContext);
      setFollowupA(res.answer);
    } catch (e) {
      console.error(e);
      setFollowupA("Failed to reach AI Tutor. Please try again.");
    } finally {
      setLoading(false);
      setFollowupQ('');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card"
      style={{ padding: 24, marginTop: 24 }}
    >
      <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: 20 }}>Question Review</h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {questions.map((q, idx) => {
          const userIdx = userAnswers[idx];
          const isTimeout = userIdx === -1 || userIdx === null;
          const isCorrect = !isTimeout && q.options[userIdx] === q.correct;

          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 12,
                padding: 16
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ marginTop: 2 }}>
                  {isCorrect ? (
                    <HiOutlineCheckCircle size={24} color="#10b981" />
                  ) : (
                    <HiOutlineXCircle size={24} color="#ef4444" />
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 12, lineHeight: 1.5 }}>
                    {idx + 1}. {q.question}
                  </p>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                    {!isCorrect && (
                      <div style={{ 
                        background: 'rgba(239, 68, 68, 0.1)', 
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        padding: '8px 12px', borderRadius: 8, fontSize: '0.85rem' 
                      }}>
                        <span style={{ color: '#f87171', fontWeight: 600, marginRight: 8 }}>Your Answer:</span>
                        {isTimeout ? "⏰ Time's up (No answer)" : q.options[userIdx]}
                      </div>
                    )}
                    <div style={{ 
                      background: 'rgba(16, 185, 129, 0.1)', 
                      border: '1px solid rgba(16, 185, 129, 0.2)',
                      padding: '8px 12px', borderRadius: 8, fontSize: '0.85rem' 
                    }}>
                      <span style={{ color: '#34d399', fontWeight: 600, marginRight: 8 }}>Correct Answer:</span>
                      {q.correct}
                    </div>
                  </div>

                  {q.reasoning && (
                    <div style={{ 
                      display: 'flex', gap: 8, color: 'var(--text-secondary)',
                      fontSize: '0.85rem', background: 'rgba(0,0,0,0.2)', padding: '10px 12px', borderRadius: 8
                    }}>
                      <HiOutlineInformationCircle size={18} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
                      <p style={{ lineHeight: 1.5 }}>{q.reasoning}</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'center' }}>
        <button onClick={onRetake} className="btn-gradient" style={{ padding: '10px 24px', flex: 1, maxWidth: 200, display: 'flex', justifyContent: 'center' }}>
          Retake Quiz
        </button>
        <button onClick={onNewTopic} className="glass-button" style={{ padding: '10px 24px', flex: 1, maxWidth: 200, display: 'flex', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)', borderRadius: 8, color: 'var(--text-primary)', cursor: 'pointer' }}>
          New Topic
        </button>
      </div>

      <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--border-subtle)' }}>
        <h4 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <HiOutlineChatBubbleLeftRight size={20} style={{ color: 'var(--accent-blue)' }} />
          Follow-up Questions?
        </h4>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
          Still confused about a quiz topic? Ask the AI Tutor for clarification. It knows which questions you missed.
        </p>
        
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <input 
            value={followupQ} 
            onChange={e => setFollowupQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleFollowup()}
            placeholder="e.g., Why is option B incorrect in question #2?" 
            className="glass-input" 
            style={{ flex: 1 }} 
          />
          <button 
            onClick={handleFollowup} 
            disabled={loading || !followupQ.trim()} 
            className="btn-gradient"
            style={{ padding: '10px 20px', whiteSpace: 'nowrap' }}
          >
            {loading ? 'Thinking...' : 'Ask Tutor'}
          </button>
        </div>

        {followupA && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            style={{ 
              background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)',
              padding: 16, borderRadius: 12, fontSize: '0.95rem'
            }}
          >
            <MarkdownRenderer content={followupA} />
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
