'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getFlashcards, saveFlashcards, createCard, deleteCard,
  getCardsDueToday, getDeckNames, getCardsInDeck, reviewCard, Flashcard,
} from '@/lib/flashcardStore';
import { logActivity } from '@/lib/streakTracker';
import api from '@/lib/api';
import {
  HiOutlinePlus, HiOutlineXMark, HiOutlineSparkles,
  HiOutlineArrowPath, HiOutlineTrash, HiOutlineCheckCircle,
} from 'react-icons/hi2';

type View = 'decks' | 'review' | 'browse' | 'newCard' | 'aiGenerate';

export default function FlashcardsPage() {
  const [view, setView] = useState<View>('decks');
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [deckNames, setDeckNames] = useState<string[]>([]);
  const [selectedDeck, setSelectedDeck] = useState('');
  const [dueCount, setDueCount] = useState(0);

  // Review state
  const [reviewQueue, setReviewQueue] = useState<Flashcard[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewDone, setReviewDone] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);

  // New card state
  const [newFront, setNewFront] = useState('');
  const [newBack, setNewBack] = useState('');
  const [newDeck, setNewDeck] = useState('');

  // AI generate state
  const [aiText, setAiText] = useState('');
  const [aiDeck, setAiDeck] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    logActivity('flashcards_visit');
    refreshData();
  }, []);

  const refreshData = () => {
    const all = getFlashcards();
    setCards(all);
    setDeckNames(getDeckNames());
    setDueCount(getCardsDueToday().length);
  };

  const startReview = (deck: string) => {
    const deckCards = deck ? getCardsInDeck(deck) : getCardsDueToday();
    const due = deckCards.filter(c => c.dueDate <= new Date().toISOString().split('T')[0]);
    if (due.length === 0) {
      // No due cards, show all
      setReviewQueue(deckCards.slice(0, 20));
    } else {
      setReviewQueue(due);
    }
    setReviewIndex(0);
    setFlipped(false);
    setReviewDone(false);
    setReviewedCount(0);
    setSelectedDeck(deck);
    setView('review');
  };

  const handleRate = (quality: number) => {
    if (reviewIndex >= reviewQueue.length) return;
    const card = reviewQueue[reviewIndex];
    reviewCard(card.id, quality);
    logActivity('flashcard_review');
    setReviewedCount(r => r + 1);

    if (reviewIndex < reviewQueue.length - 1) {
      setReviewIndex(i => i + 1);
      setFlipped(false);
    } else {
      setReviewDone(true);
    }
    refreshData();
  };

  const handleCreateCard = () => {
    if (!newFront.trim() || !newBack.trim() || !newDeck.trim()) return;
    createCard({ front: newFront, back: newBack, deckName: newDeck, source: 'manual' });
    setNewFront('');
    setNewBack('');
    refreshData();
    setView('decks');
  };

  const handleAIGenerate = async () => {
    if (!aiText.trim() || !aiDeck.trim()) return;
    setAiLoading(true);
    try {
      const prompt = `Extract 10-15 flashcard pairs from this content. Return ONLY valid JSON array: [{"front": "term or question", "back": "definition or answer"}]. Content: ${aiText.slice(0, 3000)}`;
      const res = await api.queryAI(prompt);
      let parsed: { front: string; back: string }[] = [];
      try {
        const match = res.answer.match(/\[[\s\S]*\]/);
        if (match) parsed = JSON.parse(match[0]);
      } catch {
        // Fallback
      }
      if (parsed.length > 0) {
        parsed.forEach(p => {
          createCard({ front: p.front, back: p.back, deckName: aiDeck, source: 'AI Generated' });
        });
        refreshData();
        setView('decks');
        setAiText('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAiLoading(false);
    }
  };

  const handleDeleteCard = (id: string) => {
    deleteCard(id);
    refreshData();
  };

  const currentCard = reviewQueue[reviewIndex];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 4 }}>Flashcards</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Master concepts with spaced repetition
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setNewDeck(deckNames[0] || 'My Deck'); setView('newCard'); }} className="btn-gradient" style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}>
            <HiOutlinePlus size={16} /> New Card
          </button>
          <button onClick={() => setView('aiGenerate')} style={{
            padding: '10px 18px', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)',
            color: '#8b5cf6', fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 600,
          }}>
            <HiOutlineSparkles size={16} /> AI Generate
          </button>
        </div>
      </div>

      {/* Stat pills */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Due Today', value: dueCount, color: '#f59e0b' },
          { label: 'Total Cards', value: cards.length, color: '#3b82f6' },
          { label: 'Decks', value: deckNames.length, color: '#8b5cf6' },
        ].map((s, i) => (
          <div key={i} style={{
            padding: '10px 18px', borderRadius: 10,
            background: `${s.color}10`, border: `1px solid ${s.color}20`,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 700, color: s.color }}>{s.value}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Deck View */}
      {view === 'decks' && (
        <div>
          {deckNames.length === 0 ? (
            <div className="glass-card" style={{ padding: 60, textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: 16, opacity: 0.3 }}>🃏</div>
              <p style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>No flashcards yet</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>Create cards manually or generate from AI</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {/* Due today card */}
              {dueCount > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="glass-card" style={{
                    padding: 24, cursor: 'pointer',
                    background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(236,72,153,0.08))',
                    border: '1px solid rgba(245,158,11,0.2)',
                  }}
                  onClick={() => startReview('')}
                >
                  <div style={{ fontSize: '2rem', marginBottom: 12 }}>📚</div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 4 }}>Due Today</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{dueCount} cards ready for review</p>
                  <div className="btn-gradient" style={{ marginTop: 16, padding: '8px 16px', textAlign: 'center', fontSize: '0.85rem', borderRadius: 8 }}>
                    Start Review
                  </div>
                </motion.div>
              )}

              {deckNames.map((deck, i) => {
                const deckCards = getCardsInDeck(deck);
                const deckDue = deckCards.filter(c => c.dueDate <= new Date().toISOString().split('T')[0]).length;
                return (
                  <motion.div key={deck} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="glass-card" style={{ padding: 24 }}
                  >
                    <div style={{ fontSize: '1.5rem', marginBottom: 12 }}>🃏</div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 4 }}>{deck}</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                      {deckCards.length} cards • {deckDue} due
                    </p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Source: {deckCards[0]?.source || 'manual'}
                    </p>
                    <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                      <button onClick={() => startReview(deck)} className="btn-gradient" style={{ flex: 1, padding: '8px 12px', fontSize: '0.8rem', borderRadius: 8 }}>
                        Review
                      </button>
                      <button onClick={() => { setSelectedDeck(deck); setView('browse'); }} style={{
                        flex: 1, padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                        background: 'transparent', border: '1px solid var(--border-default)',
                        color: 'var(--text-secondary)', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 500,
                      }}>
                        Browse
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Review Mode */}
      {view === 'review' && (
        <div>
          <button onClick={() => { setView('decks'); refreshData(); }} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontFamily: 'inherit', fontSize: '0.85rem',
            marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4,
          }}>
            ← Back to decks
          </button>

          {reviewDone ? (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="glass-card" style={{ padding: 48, textAlign: 'center' }}
            >
              <div style={{ fontSize: '3rem', marginBottom: 16 }}>🎉</div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 8 }}>Session Complete!</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: 4 }}>You reviewed {reviewedCount} cards</p>
              <button onClick={() => setView('decks')} className="btn-gradient" style={{ marginTop: 20, padding: '10px 24px' }}>
                Done
              </button>
            </motion.div>
          ) : currentCard ? (
            <div>
              {/* Progress */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                  <span>Card {reviewIndex + 1} of {reviewQueue.length}</span>
                  <span>{selectedDeck || 'All Due'}</span>
                </div>
                <div className="progress-bar" style={{ height: 4 }}>
                  <div className="progress-bar-fill" style={{ width: `${((reviewIndex + 1) / reviewQueue.length) * 100}%` }} />
                </div>
              </div>

              {/* Card */}
              <div
                onClick={() => setFlipped(!flipped)}
                style={{
                  perspective: '1000px',
                  cursor: 'pointer',
                  maxWidth: 500,
                  margin: '0 auto',
                  minHeight: 280,
                }}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={flipped ? 'back' : 'front'}
                    initial={{ rotateY: 90, opacity: 0 }}
                    animate={{ rotateY: 0, opacity: 1 }}
                    exit={{ rotateY: -90, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="glass-card"
                    style={{
                      padding: 40, minHeight: 280,
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                      textAlign: 'center',
                      background: flipped
                        ? 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(6,182,212,0.08))'
                        : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${flipped ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.08)'}`,
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>
                      {flipped ? 'Answer' : 'Question'}
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 600, lineHeight: 1.6 }}>
                      {flipped ? currentCard.back : currentCard.front}
                    </div>
                    {!flipped && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 24 }}>
                        Click to reveal answer
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Rating buttons */}
              {flipped && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20, maxWidth: 500, margin: '20px auto 0' }}
                >
                  {[
                    { label: 'Again', quality: 0, color: '#ef4444' },
                    { label: 'Hard', quality: 2, color: '#f59e0b' },
                    { label: 'Good', quality: 3, color: '#3b82f6' },
                    { label: 'Easy', quality: 5, color: '#10b981' },
                  ].map(r => (
                    <button key={r.quality} onClick={() => handleRate(r.quality)} style={{
                      flex: 1, padding: '12px 8px', borderRadius: 10, cursor: 'pointer',
                      background: `${r.color}10`, border: `1px solid ${r.color}30`,
                      color: r.color, fontFamily: 'inherit', fontWeight: 600, fontSize: '0.85rem',
                    }}>
                      {r.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </div>
          ) : (
            <div className="glass-card" style={{ padding: 48, textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)' }}>No cards to review</p>
            </div>
          )}
        </div>
      )}

      {/* Browse Mode */}
      {view === 'browse' && (
        <div>
          <button onClick={() => setView('decks')} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontFamily: 'inherit', fontSize: '0.85rem',
            marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4,
          }}>
            ← Back to decks
          </button>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: 16 }}>{selectedDeck}</h2>
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 120px 60px',
              padding: '12px 20px', borderBottom: '1px solid var(--border-default)',
              fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5,
            }}>
              <span>Front</span><span>Back</span><span>Due</span><span></span>
            </div>
            {getCardsInDeck(selectedDeck).map(card => (
              <div key={card.id} style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 120px 60px',
                padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)',
                fontSize: '0.85rem', alignItems: 'center',
              }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.front}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{card.back}</span>
                <span style={{ fontSize: '0.75rem', color: card.dueDate <= new Date().toISOString().split('T')[0] ? '#f59e0b' : 'var(--text-muted)' }}>
                  {card.dueDate}
                </span>
                <button onClick={() => handleDeleteCard(card.id)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4,
                }}>
                  <HiOutlineTrash size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New Card Modal */}
      {view === 'newCard' && (
        <div>
          <button onClick={() => setView('decks')} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontFamily: 'inherit', fontSize: '0.85rem',
            marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4,
          }}>
            ← Back
          </button>
          <div className="glass-card" style={{ padding: 28, maxWidth: 500 }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: 20 }}>➕ New Flashcard</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 6 }}>Deck</label>
                <input value={newDeck} onChange={e => setNewDeck(e.target.value)} placeholder="Deck name..." className="glass-input" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 6 }}>Front (Question)</label>
                <textarea value={newFront} onChange={e => setNewFront(e.target.value)}
                  placeholder="Enter the question or term..."
                  className="glass-input" style={{ minHeight: 80, resize: 'vertical' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 6 }}>Back (Answer)</label>
                <textarea value={newBack} onChange={e => setNewBack(e.target.value)}
                  placeholder="Enter the definition or answer..."
                  className="glass-input" style={{ minHeight: 80, resize: 'vertical' }} />
              </div>
              <button onClick={handleCreateCard} className="btn-gradient" style={{ padding: '12px 24px' }}
                disabled={!newFront.trim() || !newBack.trim() || !newDeck.trim()}>
                Create Card
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Generate */}
      {view === 'aiGenerate' && (
        <div>
          <button onClick={() => setView('decks')} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontFamily: 'inherit', fontSize: '0.85rem',
            marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4,
          }}>
            ← Back
          </button>
          <div className="glass-card" style={{ padding: 28, maxWidth: 600 }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
              <HiOutlineSparkles size={20} color="#8b5cf6" /> Generate from AI
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>
              Paste content and AI will extract 10–15 flashcard pairs
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input value={aiDeck} onChange={e => setAiDeck(e.target.value)} placeholder="Deck name..." className="glass-input" />
              <textarea value={aiText} onChange={e => setAiText(e.target.value)}
                placeholder="Paste study content here..."
                className="glass-input" style={{ minHeight: 160, resize: 'vertical' }} />
              <button onClick={handleAIGenerate} disabled={aiLoading || !aiText.trim() || !aiDeck.trim()}
                className="btn-gradient" style={{
                  padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  opacity: aiLoading || !aiText.trim() || !aiDeck.trim() ? 0.5 : 1,
                }}>
                {aiLoading ? (
                  <><HiOutlineArrowPath size={16} className="float-3d" /> Generating...</>
                ) : (
                  <><HiOutlineSparkles size={16} /> Generate Flashcards</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
