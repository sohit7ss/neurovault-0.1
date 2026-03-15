import { motion } from 'framer-motion';
import { HiOutlineAcademicCap, HiOutlineDocumentText, HiOutlineGlobeAlt, HiOutlineLightBulb } from 'react-icons/hi2';

export type Difficulty = 'easy' | 'medium' | 'hard';
export type QuestionCount = 5 | 10 | 15;
export type KnowledgeSource = 'general' | 'documents';

interface QuizSettingsProps {
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
  questionCount: QuestionCount;
  setQuestionCount: (c: QuestionCount) => void;
  source: KnowledgeSource;
  setSource: (s: KnowledgeSource) => void;
}

export default function QuizSettings({
  difficulty, setDifficulty,
  questionCount, setQuestionCount,
  source, setSource
}: QuizSettingsProps) {
  return (
    <div className="glass-card" style={{ padding: '20px 24px', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Row: Difficulty & Count */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }}>
        
        {/* Difficulty Toggle */}
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 500 }}>
            <HiOutlineLightBulb /> Difficulty Level
          </label>
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: 4, borderRadius: 12, gap: 4 }}>
            {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => {
              const isActive = difficulty === d;
              return (
                <motion.button
                  key={d}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setDifficulty(d)}
                  style={{
                    flex: 1, padding: '8px 12px', fontSize: '0.85rem', fontWeight: isActive ? 600 : 500,
                    textTransform: 'capitalize', cursor: 'pointer', border: 'none', borderRadius: 8,
                    background: isActive ? 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(139,92,246,0.2))' : 'transparent',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                    boxShadow: isActive ? 'inset 0 0 0 1px rgba(139,92,246,0.3), 0 0 12px rgba(139,92,246,0.2)' : 'none',
                    transition: 'color 0.2s, background 0.2s'
                  }}
                >
                  {d}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Question Count Toggle */}
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 500 }}>
            <HiOutlineAcademicCap /> Questions
          </label>
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: 4, borderRadius: 12, gap: 4 }}>
            {([5, 10, 15] as QuestionCount[]).map(c => {
              const isActive = questionCount === c;
              return (
                <motion.button
                  key={c}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setQuestionCount(c)}
                  style={{
                    flex: 1, padding: '8px 12px', fontSize: '0.85rem', fontWeight: isActive ? 600 : 500,
                    cursor: 'pointer', border: 'none', borderRadius: 8,
                    background: isActive ? 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(59,130,246,0.2))' : 'transparent',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                    boxShadow: isActive ? 'inset 0 0 0 1px rgba(16,185,129,0.3), 0 0 12px rgba(16,185,129,0.2)' : 'none',
                    transition: 'color 0.2s, background 0.2s'
                  }}
                >
                  {c}
                </motion.button>
              );
            })}
          </div>
        </div>

      </div>

      <div style={{ height: 1, background: 'var(--border-subtle)' }} />

      {/* Bottom Row: Source Knowledge */}
      <div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 500 }}>
          <HiOutlineDocumentText /> Knowledge Base Source
        </label>
        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: 4, borderRadius: 12, gap: 4, maxWidth: 400 }}>
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => setSource('general')}
            style={{
              flex: 1, padding: '10px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              cursor: 'pointer', border: 'none', borderRadius: 8, fontWeight: source === 'general' ? 600 : 500,
              background: source === 'general' ? 'rgba(59,130,246,0.15)' : 'transparent',
              color: source === 'general' ? 'var(--accent-blue)' : 'var(--text-muted)',
              borderBottom: source === 'general' ? '2px solid var(--accent-blue)' : '2px solid transparent',
            }}
          >
            <HiOutlineGlobeAlt size={16} /> General AI Knowledge
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => setSource('documents')}
            style={{
              flex: 1, padding: '10px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              cursor: 'pointer', border: 'none', borderRadius: 8, fontWeight: source === 'documents' ? 600 : 500,
              background: source === 'documents' ? 'rgba(16,185,129,0.15)' : 'transparent',
              color: source === 'documents' ? '#10b981' : 'var(--text-muted)',
              borderBottom: source === 'documents' ? '2px solid #10b981' : '2px solid transparent',
            }}
          >
            <HiOutlineDocumentText size={16} /> My Documents First
          </motion.button>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8, marginLeft: 4 }}>
          {source === 'general' 
            ? 'The AI will generate questions using its vast general knowledge base.'
            : 'The AI will strictly search your uploaded NeuroVault documents for context. If none are found, it warns you.'}
        </p>
      </div>

    </div>
  );
}
