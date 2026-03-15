import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { QuizQuestion as QuizQuestionType } from '@/lib/api';
import { HiOutlineCheckCircle, HiOutlineXCircle } from 'react-icons/hi2';

interface QuizQuestionProps {
  question: QuizQuestionType;
  currentNum: number;
  totalNum: number;
  selected: number | null;
  showResult: boolean;
  score: number;
  onSelect: (index: number) => void;
  onNext: () => void;
}

export default function QuizQuestion({
  question, currentNum, totalNum, selected, showResult, score, onSelect, onNext
}: QuizQuestionProps) {
  const [timeLeft, setTimeLeft] = useState(30);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setTimeLeft(30);
    
    if (!showResult) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            onSelect(-1); // Auto-fail on timeout
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentNum, showResult, onSelect]);

  let timerColor = '#10b981'; // Green
  if (timeLeft <= 15 && timeLeft > 5) timerColor = '#f59e0b'; // Amber
  if (timeLeft <= 5) timerColor = '#ef4444'; // Red

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="glass-card" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Question {currentNum} of {totalNum}
        </span>
        <span style={{ fontSize: '0.85rem', color: 'var(--accent-blue)', fontWeight: 600 }}>
          Score: {score}/{totalNum}
        </span>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 6, color: timerColor, fontWeight: 600 }}>
          <span>Time Remaining</span>
          <span>0:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}</span>
        </div>
        <div className="progress-bar" style={{ height: 6, overflow: 'hidden' }}>
          <div 
            className={`progress-bar-fill ${timeLeft <= 5 ? 'pulse-anim' : ''}`}
            style={{ 
              width: `${(timeLeft / 30) * 100}%`, 
              background: timerColor,
              transition: 'width 1s linear, background-color 0.3s ease'
            }} 
          />
        </div>
      </div>

      <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: 20, lineHeight: 1.5 }}>
        {question.question}
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {question.options.map((opt, i) => {
          let bg = 'rgba(255,255,255,0.02)';
          let border = 'var(--border-default)';
          let icon = null;
          
          if (showResult) {
            if (opt === question.correct) { 
              bg = 'rgba(16,185,129,0.1)'; 
              border = 'rgba(16,185,129,0.3)'; 
              icon = <HiOutlineCheckCircle style={{ color: '#10b981' }} />; 
            }
            else if (i === selected && opt !== question.correct) { 
              bg = 'rgba(239,68,68,0.1)'; 
              border = 'rgba(239,68,68,0.3)'; 
              icon = <HiOutlineXCircle style={{ color: '#ef4444' }} />; 
            }
          }

          return (
            <button key={i} onClick={() => !showResult && onSelect(i)} style={{
              padding: '12px 16px', borderRadius: 10, textAlign: 'left',
              background: bg, border: `1px solid ${border}`, cursor: showResult ? 'default' : 'pointer',
              color: 'inherit', fontFamily: 'inherit', fontSize: '0.9rem',
              display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.2s',
            }}>
              <span style={{
                width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                background: 'rgba(255,255,255,0.05)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem',
                fontWeight: 600, color: 'var(--text-muted)',
              }}>
                {String.fromCharCode(65 + i)}
              </span>
              {opt}
              {icon && <span style={{ marginLeft: 'auto' }}>{icon}</span>}
            </button>
          );
        })}
      </div>

      {showResult && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginTop: 16 }}>
          {selected === -1 && (
            <div style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: 12, fontWeight: 500 }}>
              ⏰ Time's up! The correct answer was {question.correct}.
            </div>
          )}
          <button onClick={onNext} className="btn-gradient"
            style={{ padding: '10px 24px' }}>
            {currentNum < totalNum ? 'Next Question →' : 'See Results'}
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}
