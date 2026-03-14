'use client';

import { useEffect, useState, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthProvider, useAuth } from '@/lib/auth';
import {
  HiOutlineSquares2X2, HiOutlineDocumentText, HiOutlineChatBubbleLeftRight,
  HiOutlineMap, HiOutlineArrowRightOnRectangle, HiOutlineBars3, HiOutlineXMark,
  HiOutlineUser, HiOutlineLightBulb, HiOutlineShare, HiOutlineAcademicCap,
  HiOutlineTrophy,
} from 'react-icons/hi2';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: HiOutlineSquares2X2 },
  { href: '/documents', label: 'Documents', icon: HiOutlineDocumentText },
  { href: '/chat', label: 'AI Search', icon: HiOutlineChatBubbleLeftRight },
  { href: '/roadmap', label: 'Roadmaps', icon: HiOutlineMap },
  { href: '/mindmap', label: 'Mind Maps', icon: HiOutlineLightBulb },
  { href: '/knowledge', label: 'Knowledge Graph', icon: HiOutlineShare },
  { href: '/quiz', label: 'AI Tutor', icon: HiOutlineAcademicCap },
  { href: '/workspaces', label: 'Workspaces', icon: HiOutlineUser },
  { href: '/achievements', label: 'Achievements', icon: HiOutlineTrophy },
];

function DashboardContent({ children }: { children: ReactNode }) {
  const { user, loading, logout, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [loading, isAuthenticated, router]);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-primary)',
      }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          style={{
            width: 40, height: 40, border: '3px solid rgba(59,130,246,0.2)',
            borderTopColor: '#3b82f6', borderRadius: '50%',
          }}
        />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <div className="mesh-gradient" />
      
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 40,
              background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
            }}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        {/* Logo */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '0 8px', marginBottom: 40,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 800, flexShrink: 0,
          }}>
            N
          </div>
          <span style={{ fontSize: '1.1rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
            NeuroVault
          </span>
        </div>

        {/* Nav Items */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon size={20} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div style={{
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: 16, marginTop: 16,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '8px', marginBottom: 8,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(59,130,246,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <HiOutlineUser size={18} style={{ color: 'var(--accent-blue)' }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: '0.85rem', fontWeight: 600,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {user?.name}
              </div>
              <div style={{
                fontSize: '0.75rem', color: 'var(--text-muted)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {user?.email}
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="sidebar-link"
            style={{
              width: '100%', border: 'none', cursor: 'pointer',
              background: 'transparent', fontFamily: 'inherit',
            }}
          >
            <HiOutlineArrowRightOnRectangle size={20} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        {/* Mobile header */}
        <div style={{
          display: 'none', alignItems: 'center', gap: 12, marginBottom: 24,
        }}
        className="mobile-header"
        >
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              background: 'none', border: '1px solid var(--border-default)',
              borderRadius: 8, padding: 8, cursor: 'pointer',
              color: 'var(--text-primary)',
            }}
          >
            {sidebarOpen ? <HiOutlineXMark size={20} /> : <HiOutlineBars3 size={20} />}
          </button>
          <span style={{ fontWeight: 600 }}>NeuroVault</span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      </main>

      <style jsx>{`
        @media (max-width: 768px) {
          .mobile-header { display: flex !important; }
        }
      `}</style>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <DashboardContent>{children}</DashboardContent>
    </AuthProvider>
  );
}
