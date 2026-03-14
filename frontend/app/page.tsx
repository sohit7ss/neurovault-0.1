'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { 
  HiOutlineSparkles, HiOutlineDocumentText, HiOutlineMap, 
  HiOutlineLightBulb, HiOutlineShieldCheck, HiOutlineChatBubbleLeftRight 
} from 'react-icons/hi2';

const features = [
  {
    icon: HiOutlineDocumentText,
    title: 'Smart Document Storage',
    description: 'Upload PDFs, DOCX, TXT files. AI extracts, indexes, and makes every word searchable.',
    gradient: 'from-blue-500 to-cyan-400',
  },
  {
    icon: HiOutlineChatBubbleLeftRight,
    title: 'Private AI Search',
    description: 'Ask questions about YOUR documents. RAG-powered answers from your personal knowledge base.',
    gradient: 'from-purple-500 to-pink-400',
  },
  {
    icon: HiOutlineMap,
    title: 'Learning Roadmaps',
    description: 'AI generates personalized learning paths based on your goals and current knowledge.',
    gradient: 'from-emerald-500 to-teal-400',
  },
  {
    icon: HiOutlineLightBulb,
    title: 'Knowledge Graphs',
    description: 'Visualize connections between concepts across all your documents.',
    gradient: 'from-amber-500 to-orange-400',
  },
  {
    icon: HiOutlineShieldCheck,
    title: 'Enterprise Security',
    description: 'Zero-knowledge encryption, JWT auth, per-user data isolation. Your data stays yours.',
    gradient: 'from-red-500 to-pink-400',
  },
  {
    icon: HiOutlineSparkles,
    title: 'AI Mentor',
    description: 'Summarize documents, generate quizzes, explain concepts — your personal AI tutor.',
    gradient: 'from-violet-500 to-indigo-400',
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.3 },
  },
};

const item = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
      {/* Animated Background */}
      <div className="mesh-gradient" />
      
      {/* Additional floating orbs */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden'
      }}>
        <motion.div
          animate={{ x: [0, 100, 0], y: [0, -80, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute', top: '20%', right: '20%',
            width: 300, height: 300, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(6,182,212,0.1) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
        <motion.div
          animate={{ x: [0, -60, 0], y: [0, 100, 0], scale: [1, 0.8, 1] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut', delay: 5 }}
          style={{
            position: 'absolute', bottom: '20%', left: '10%',
            width: 400, height: 400, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />
      </div>

      {/* Navigation */}
      <motion.nav
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
        style={{
          position: 'relative', zIndex: 10,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '20px 40px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 800,
          }}>
            N
          </div>
          <span style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
            NeuroVault
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/login" style={{
            padding: '10px 24px', borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'var(--text-secondary)', textDecoration: 'none',
            fontSize: '0.9rem', fontWeight: 500,
            transition: 'all 0.2s',
          }}>
            Sign In
          </Link>
          <Link href="/register" className="btn-gradient" style={{
            textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
            padding: '10px 24px',
          }}>
            Get Started
          </Link>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <div style={{
        position: 'relative', zIndex: 10,
        maxWidth: 1200, margin: '0 auto',
        padding: '80px 40px 60px',
        textAlign: 'center',
      }}>
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <span style={{
            display: 'inline-block',
            padding: '6px 16px', borderRadius: 20,
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            fontSize: '0.85rem', color: 'var(--accent-blue)',
            fontWeight: 500, marginBottom: 24,
          }}>
            ✨ AI-Powered Knowledge Platform
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          style={{
            fontSize: 'clamp(2.5rem, 5vw, 4.5rem)',
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
            marginBottom: 24,
          }}
        >
          Your{' '}
          <span style={{
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6, #ec4899)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            AI Second Brain
          </span>
          <br />
          <span style={{ color: 'var(--text-secondary)' }}>
            for Private Knowledge
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          style={{
            fontSize: '1.2rem',
            color: 'var(--text-secondary)',
            maxWidth: 600, margin: '0 auto 40px',
            lineHeight: 1.7,
          }}
        >
          Upload your documents, search with private AI, generate personalized roadmaps,
          and build interconnected knowledge graphs. All secured with enterprise-grade encryption.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}
        >
          <Link href="/register" className="btn-gradient" style={{
            textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
            gap: 8, padding: '14px 32px', fontSize: '1rem',
          }}>
            <HiOutlineSparkles />
            Start Building Your Vault
          </Link>
          <Link href="/login" style={{
            padding: '14px 32px', borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'var(--text-primary)', textDecoration: 'none',
            fontSize: '1rem', fontWeight: 500,
            background: 'rgba(255,255,255,0.03)',
            display: 'inline-flex', alignItems: 'center', gap: 8,
            transition: 'all 0.3s',
          }}>
            View Demo →
          </Link>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.8 }}
          style={{
            display: 'flex', gap: 40, justifyContent: 'center',
            marginTop: 60, paddingTop: 40,
            borderTop: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          {[
            { value: '100%', label: 'Private' },
            { value: 'RAG', label: 'AI Search' },
            { value: 'AES-256', label: 'Encryption' },
            { value: '∞', label: 'Knowledge' },
          ].map((stat, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '1.5rem', fontWeight: 700,
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                {stat.value}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
                {stat.label}
              </div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Features Grid */}
      <div style={{
        position: 'relative', zIndex: 10,
        maxWidth: 1200, margin: '0 auto',
        padding: '40px 40px 100px',
      }}>
        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 24,
          }}
        >
          {features.map((feature, i) => (
            <motion.div
              key={i}
              variants={item}
              className="glass-card"
              style={{ padding: 28, cursor: 'default' }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: `linear-gradient(135deg, ${feature.gradient.includes('blue') ? 'rgba(59,130,246,0.15)' : feature.gradient.includes('purple') ? 'rgba(139,92,246,0.15)' : feature.gradient.includes('emerald') ? 'rgba(16,185,129,0.15)' : feature.gradient.includes('amber') ? 'rgba(245,158,11,0.15)' : feature.gradient.includes('red') ? 'rgba(239,68,68,0.15)' : 'rgba(124,58,237,0.15)'}, transparent)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 16,
              }}>
                <feature.icon size={24} style={{
                  color: feature.gradient.includes('blue') ? '#3b82f6' : feature.gradient.includes('purple') ? '#a855f7' : feature.gradient.includes('emerald') ? '#10b981' : feature.gradient.includes('amber') ? '#f59e0b' : feature.gradient.includes('red') ? '#ef4444' : '#7c3aed',
                }} />
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 8 }}>
                {feature.title}
              </h3>
              <p style={{
                fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6,
              }}>
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Footer */}
      <footer style={{
        position: 'relative', zIndex: 10,
        textAlign: 'center', padding: '40px 20px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        color: 'var(--text-muted)', fontSize: '0.85rem',
      }}>
        <p>© 2026 NeuroVault. Built with AI, for AI-powered learning.</p>
      </footer>
    </div>
  );
}
