'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { saveUserProfile, getUserProfile } from '@/lib/userProfile';
import {
  HiOutlineAcademicCap, HiOutlineRocketLaunch, HiOutlineClock,
  HiOutlineChartBar, HiOutlineBookOpen, HiOutlineCodeBracket,
  HiOutlineCheckCircle, HiOutlineChevronRight, HiOutlineChevronLeft,
} from 'react-icons/hi2';

const CAREER_OPTIONS = [
  'Software Engineer', 'Data Scientist', 'AI Engineer', 'Frontend Developer',
  'Backend Developer', 'DevOps Engineer', 'Mobile Developer', 'Cloud Architect',
  'Cybersecurity Analyst', 'Product Manager',
];

interface Props {
  onComplete: () => void;
}

export default function OnboardingWizard({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [careerGoal, setCareerGoal] = useState('');
  const [skillLevel, setSkillLevel] = useState('');
  const [dailyTime, setDailyTime] = useState('');
  const [learningStyle, setLearningStyle] = useState('');
  const [done, setDone] = useState(false);
  const [direction, setDirection] = useState(1);

  const totalSteps = 4;

  const canProceed = () => {
    if (step === 0) return careerGoal !== '';
    if (step === 1) return skillLevel !== '';
    if (step === 2) return dailyTime !== '';
    if (step === 3) return learningStyle !== '';
    return false;
  };

  const handleNext = () => {
    if (step < totalSteps - 1) {
      setDirection(1);
      setStep(s => s + 1);
    } else {
      // Complete
      const profile = getUserProfile();
      saveUserProfile({
        ...profile,
        careerGoal,
        skillLevel,
        dailyTime,
        learningStyle,
        onboardingComplete: true,
      });
      setDone(true);
      setTimeout(() => {
        onComplete();
      }, 1800);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setDirection(-1);
      setStep(s => s - 1);
    }
  };

  const slideVariants = {
    enter: (d: number) => ({ x: d > 0 ? 300 : -300, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -300 : 300, opacity: 0 }),
  };

  if (done) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          style={{ textAlign: 'center' }}
        >
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
            style={{
              width: 100, height: 100, borderRadius: '50%', margin: '0 auto 24px',
              background: 'linear-gradient(135deg, #10b981, #06b6d4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <HiOutlineCheckCircle size={48} color="#fff" />
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 8 }}
          >
            You&apos;re all set! 🎉
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}
          >
            Your dashboard is being personalized...
          </motion.p>
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{
          width: '100%', maxWidth: 560, padding: 40,
          background: 'rgba(22, 24, 54, 0.95)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20, position: 'relative', overflow: 'hidden',
        }}
      >
        {/* Progress bar */}
        <div style={{ marginBottom: 32 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', marginBottom: 8,
            fontSize: '0.8rem', color: 'var(--text-muted)',
          }}>
            <span>Step {step + 1} of {totalSteps}</span>
            <span>{Math.round(((step + 1) / totalSteps) * 100)}%</span>
          </div>
          <div style={{
            height: 4, borderRadius: 4,
            background: 'rgba(255,255,255,0.06)',
          }}>
            <motion.div
              animate={{ width: `${((step + 1) / totalSteps) * 100}%` }}
              transition={{ duration: 0.4 }}
              style={{
                height: '100%', borderRadius: 4,
                background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
              }}
            />
          </div>
        </div>

        {/* Step content */}
        <div style={{ minHeight: 300, position: 'relative' }}>
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3 }}
            >
              {step === 0 && (
                <div>
                  <div style={{
                    width: 56, height: 56, borderRadius: 14,
                    background: 'rgba(59,130,246,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 20,
                  }}>
                    <HiOutlineRocketLaunch size={28} color="#3b82f6" />
                  </div>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 8 }}>
                    What&apos;s your career goal?
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 24 }}>
                    We&apos;ll personalize your learning experience based on your target.
                  </p>
                  <select
                    value={careerGoal}
                    onChange={e => setCareerGoal(e.target.value)}
                    className="glass-input"
                    style={{ width: '100%', cursor: 'pointer' }}
                  >
                    <option value="" disabled>Select a career path...</option>
                    {CAREER_OPTIONS.map(c => (
                      <option key={c} value={c} style={{ background: '#161836', color: '#f1f5f9' }}>{c}</option>
                    ))}
                  </select>
                </div>
              )}

              {step === 1 && (
                <div>
                  <div style={{
                    width: 56, height: 56, borderRadius: 14,
                    background: 'rgba(139,92,246,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 20,
                  }}>
                    <HiOutlineAcademicCap size={28} color="#8b5cf6" />
                  </div>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 8 }}>
                    What&apos;s your current level?
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 24 }}>
                    This helps us calibrate difficulty and recommendations.
                  </p>
                  <div style={{ display: 'flex', gap: 12 }}>
                    {[
                      { value: 'Beginner', icon: '🌱', desc: 'Just getting started' },
                      { value: 'Intermediate', icon: '🚀', desc: 'Some experience' },
                      { value: 'Advanced', icon: '⚡', desc: 'Experienced professional' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setSkillLevel(opt.value)}
                        style={{
                          flex: 1, padding: '20px 12px', borderRadius: 14, cursor: 'pointer',
                          background: skillLevel === opt.value
                            ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.03)',
                          border: `2px solid ${skillLevel === opt.value
                            ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.06)'}`,
                          color: 'inherit', fontFamily: 'inherit', textAlign: 'center',
                          transition: 'all 0.2s',
                        }}
                      >
                        <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>{opt.icon}</div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>{opt.value}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div>
                  <div style={{
                    width: 56, height: 56, borderRadius: 14,
                    background: 'rgba(16,185,129,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 20,
                  }}>
                    <HiOutlineClock size={28} color="#10b981" />
                  </div>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 8 }}>
                    How much time per day?
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 24 }}>
                    We&apos;ll pace your roadmaps and goals accordingly.
                  </p>
                  <div style={{ display: 'flex', gap: 12 }}>
                    {['30 min', '1 hour', '2+ hours'].map(t => (
                      <button
                        key={t}
                        onClick={() => setDailyTime(t)}
                        style={{
                          flex: 1, padding: '16px 12px', borderRadius: 40, cursor: 'pointer',
                          background: dailyTime === t
                            ? 'linear-gradient(135deg, #10b981, #06b6d4)' : 'rgba(255,255,255,0.03)',
                          border: `2px solid ${dailyTime === t
                            ? 'transparent' : 'rgba(255,255,255,0.06)'}`,
                          color: dailyTime === t ? '#fff' : 'var(--text-secondary)',
                          fontFamily: 'inherit', fontWeight: 600, fontSize: '0.95rem',
                          transition: 'all 0.2s',
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div>
                  <div style={{
                    width: 56, height: 56, borderRadius: 14,
                    background: 'rgba(236,72,153,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 20,
                  }}>
                    <HiOutlineBookOpen size={28} color="#ec4899" />
                  </div>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 8 }}>
                    How do you learn best?
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 24 }}>
                    We&apos;ll prioritize resources that match your style.
                  </p>
                  <div style={{ display: 'flex', gap: 12 }}>
                    {[
                      { value: 'Visual', icon: <HiOutlineChartBar size={28} />, desc: 'Videos & diagrams' },
                      { value: 'Reading', icon: <HiOutlineBookOpen size={28} />, desc: 'Docs & articles' },
                      { value: 'Practice-heavy', icon: <HiOutlineCodeBracket size={28} />, desc: 'Projects & coding' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setLearningStyle(opt.value)}
                        style={{
                          flex: 1, padding: '20px 12px', borderRadius: 14, cursor: 'pointer',
                          background: learningStyle === opt.value
                            ? 'rgba(236,72,153,0.12)' : 'rgba(255,255,255,0.03)',
                          border: `2px solid ${learningStyle === opt.value
                            ? 'rgba(236,72,153,0.4)' : 'rgba(255,255,255,0.06)'}`,
                          color: learningStyle === opt.value ? '#ec4899' : 'var(--text-secondary)',
                          fontFamily: 'inherit', textAlign: 'center', transition: 'all 0.2s',
                        }}
                      >
                        <div style={{ marginBottom: 10, opacity: 0.9 }}>{opt.icon}</div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>{opt.value}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', marginTop: 32,
        }}>
          <button
            onClick={handleBack}
            disabled={step === 0}
            style={{
              padding: '10px 20px', borderRadius: 10, cursor: step === 0 ? 'default' : 'pointer',
              background: 'transparent', border: '1px solid var(--border-default)',
              color: step === 0 ? 'var(--text-muted)' : 'var(--text-secondary)',
              fontFamily: 'inherit', fontSize: '0.9rem', fontWeight: 500,
              opacity: step === 0 ? 0.4 : 1, transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <HiOutlineChevronLeft size={16} /> Back
          </button>
          <button
            onClick={handleNext}
            disabled={!canProceed()}
            className="btn-gradient"
            style={{
              padding: '10px 28px', borderRadius: 10,
              opacity: canProceed() ? 1 : 0.4,
              cursor: canProceed() ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {step === totalSteps - 1 ? 'Complete Setup' : 'Continue'}
            <HiOutlineChevronRight size={16} />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
