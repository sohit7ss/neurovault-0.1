'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getUserProfile, updateUserProfile } from '@/lib/userProfile';
import { getStreak } from '@/lib/streakTracker';
import { logActivity } from '@/lib/streakTracker';
import { useAuth } from '@/lib/auth';
import {
  HiOutlineUserGroup, HiOutlineTrophy, HiOutlineEnvelope,
  HiOutlineTrash, HiOutlineEyeSlash, HiOutlineEye,
} from 'react-icons/hi2';

const MOCK_NAMES = [
  'Alex Chen', 'Priya Sharma', 'Marcus Johnson', 'Yuki Tanaka', 'Fatima Ahmed',
  'Liam O\'Brien', 'Sofia Rodriguez', 'Dev Patel', 'Emma Wilson', 'Noah Kim',
  'Ava Martinez', 'Ryan Zhang', 'Mia Thompson', 'Ethan Dubois', 'Zara Hassan',
  'Lucas Silva', 'Olivia Brown', 'Kai Nakamura', 'Elena Popov', 'James Taylor',
  'Aisha Khan', 'Daniel Park', 'Chloe Davis', 'Omar Farouk', 'Isabella Lee',
  'Nathan Wright', 'Sophia Andersson', 'Ravi Gupta', 'Hannah Yang', 'Max Mueller',
  'Grace Okonkwo', 'Leo Bennett', 'Ruby Singh', 'Ethan Cooper', 'Luna Reyes',
  'Amara Diallo', 'Felix Larsson', 'Noor Ali', 'Owen Clark', 'Maya Johansson',
  'Viktor Novak', 'Zoe Hernandez', 'Arjun Reddy', 'Lily Chang', 'Sebastian Fox',
  'Ananya Rao', 'Oscar Moreno', 'Freya Olsen', 'Dante Romano',
];

function generateMockUsers(currentUserXp: number) {
  const users = MOCK_NAMES.map((name, i) => {
    const xp = Math.floor(Math.random() * 14800) + 200;
    const level = Math.floor(xp / 200) + 1;
    const streak = Math.floor(Math.random() * 45);
    return { name, xp, level, streak, id: `mock-${i}`, isUser: false };
  });
  users.sort((a, b) => b.xp - a.xp);
  return users;
}

export default function CommunityPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'global' | 'friends' | 'challenge'>('global');
  const [profile, setProfile] = useState(getUserProfile());
  const [friendEmail, setFriendEmail] = useState('');
  const streak = getStreak();
  const userXp = (profile.quizHistory?.length || 0) * 50 + 100;
  const userLevel = Math.floor(userXp / 200) + 1;

  const [mockUsers] = useState(() => generateMockUsers(userXp));

  useEffect(() => {
    logActivity('community_visit');
  }, []);

  // Insert current user into leaderboard
  const allUsers = [...mockUsers];
  const currentUser = {
    name: profile.isPublic ? (user?.name || 'You') : 'Anonymous User',
    xp: userXp,
    level: userLevel,
    streak,
    id: 'current',
    isUser: true,
  };
  allUsers.push(currentUser);
  allUsers.sort((a, b) => b.xp - a.xp);
  const userRank = allUsers.findIndex(u => u.isUser) + 1;

  const togglePublic = () => {
    const updated = updateUserProfile({ isPublic: !profile.isPublic });
    setProfile(updated);
  };

  const addFriend = () => {
    if (!friendEmail.trim() || !friendEmail.includes('@')) return;
    const friends = [...(profile.friends || [])];
    if (!friends.includes(friendEmail.trim())) {
      friends.push(friendEmail.trim());
      const updated = updateUserProfile({ friends });
      setProfile(updated);
    }
    setFriendEmail('');
  };

  const removeFriend = (email: string) => {
    const friends = (profile.friends || []).filter(f => f !== email);
    const updated = updateUserProfile({ friends });
    setProfile(updated);
  };

  // Weekly challenge mock
  const daysUntilSunday = () => {
    const now = new Date();
    const d = (7 - now.getDay()) % 7 || 7;
    return d;
  };

  const challengeUsers = allUsers.slice(0, 10);

  const tabs = [
    { key: 'global' as const, label: 'Global Leaderboard' },
    { key: 'friends' as const, label: 'Friends' },
    { key: 'challenge' as const, label: 'Weekly Challenge' },
  ];

  const getRankStyle = (rank: number) => {
    if (rank === 1) return { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', badge: '🥇' };
    if (rank === 2) return { bg: 'rgba(156,163,175,0.1)', border: 'rgba(156,163,175,0.3)', badge: '🥈' };
    if (rank === 3) return { bg: 'rgba(180,83,9,0.1)', border: 'rgba(180,83,9,0.3)', badge: '🥉' };
    return { bg: 'transparent', border: 'var(--border-subtle)', badge: '' };
  };

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 4 }}>Community</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Compete, collaborate, and grow together
        </p>
      </div>

      {/* Your rank banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card"
        style={{
          padding: '20px 24px', marginBottom: 24,
          background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(59,130,246,0.1))',
          border: '1px solid rgba(99,102,241,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.2rem', fontWeight: 700,
          }}>
            #{userRank}
          </div>
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>You are ranked #{userRank} this week</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>⚡ {userXp} XP • Level {userLevel} • 🔥 {streak} day streak</div>
          </div>
        </div>
        <button onClick={togglePublic} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 14px', borderRadius: 8,
          background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-default)',
          color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit',
          fontSize: '0.8rem', fontWeight: 500,
        }}>
          {profile.isPublic ? <HiOutlineEye size={16} /> : <HiOutlineEyeSlash size={16} />}
          {profile.isPublic ? 'Public' : 'Anonymous'}
        </button>
      </motion.div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 4 }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1, padding: '10px 16px', borderRadius: 10, cursor: 'pointer',
              background: tab === t.key ? 'rgba(59,130,246,0.12)' : 'transparent',
              border: tab === t.key ? '1px solid rgba(59,130,246,0.2)' : '1px solid transparent',
              color: tab === t.key ? '#3b82f6' : 'var(--text-muted)',
              fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 600,
              transition: 'all 0.2s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'global' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          {allUsers.slice(0, 50).map((u, i) => {
            const rank = i + 1;
            const rs = getRankStyle(rank);
            return (
              <div key={u.id} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 20px',
                background: u.isUser ? 'rgba(59,130,246,0.08)' : rs.bg,
                borderBottom: '1px solid var(--border-subtle)',
                transition: 'background 0.2s',
              }}>
                <div style={{ width: 32, textAlign: 'center', fontSize: '0.9rem', fontWeight: 700, color: rank <= 3 ? '#f59e0b' : 'var(--text-muted)' }}>
                  {rs.badge || `#${rank}`}
                </div>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: u.isUser ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)' : `hsl(${(rank * 47) % 360}, 60%, 50%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.85rem', fontWeight: 700, color: '#fff', flexShrink: 0,
                }}>
                  {u.name.charAt(0)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{u.name}</span>
                    {u.isUser && (
                      <span style={{
                        padding: '2px 8px', borderRadius: 6, fontSize: '0.65rem',
                        background: 'rgba(59,130,246,0.2)', color: '#3b82f6', fontWeight: 700,
                      }}>YOU</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <span style={{ fontWeight: 600 }}>⚡ {u.xp.toLocaleString()}</span>
                  <span style={{
                    padding: '2px 8px', borderRadius: 6, fontSize: '0.72rem',
                    background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', fontWeight: 600,
                  }}>Lv.{u.level}</span>
                  {u.streak > 0 && <span>🔥 {u.streak}</span>}
                </div>
              </div>
            );
          })}
        </motion.div>
      )}

      {tab === 'friends' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="glass-card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                value={friendEmail}
                onChange={e => setFriendEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addFriend()}
                placeholder="Enter friend's email..."
                className="glass-input"
                style={{ flex: 1 }}
              />
              <button onClick={addFriend} className="btn-gradient" style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <HiOutlineEnvelope size={16} /> Invite
              </button>
            </div>
          </div>

          {(!profile.friends || profile.friends.length === 0) ? (
            <div className="glass-card" style={{ padding: 48, textAlign: 'center' }}>
              <HiOutlineUserGroup size={48} style={{ margin: '0 auto 16px', opacity: 0.2, color: 'var(--text-muted)' }} />
              <p style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>No friends yet</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Invite friends by email to compete on the leaderboard!</p>
            </div>
          ) : (
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              {profile.friends.map((email, i) => (
                <div key={email} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: `hsl(${(i * 73) % 360}, 55%, 50%)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.85rem', fontWeight: 700, color: '#fff',
                  }}>
                    {email.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{email}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Invite pending</div>
                  </div>
                  <button onClick={() => removeFriend(email)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', padding: 4,
                  }}>
                    <HiOutlineTrash size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {tab === 'challenge' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="glass-card" style={{
            padding: 24, marginBottom: 20,
            background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(236,72,153,0.08))',
            border: '1px solid rgba(245,158,11,0.15)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <HiOutlineTrophy size={24} color="#f59e0b" />
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Most Roadmap Phases Completed This Week 🏆</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Challenge resets in {daysUntilSunday()} days</p>
              </div>
            </div>
          </div>

          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            {challengeUsers.map((u, i) => (
              <div key={u.id} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '12px 20px',
                background: u.isUser ? 'rgba(59,130,246,0.08)' : 'transparent',
                borderBottom: '1px solid var(--border-subtle)',
              }}>
                <div style={{ width: 28, textAlign: 'center', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  #{i + 1}
                </div>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: u.isUser ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)' : `hsl(${(i * 53) % 360}, 55%, 50%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.8rem', fontWeight: 700, color: '#fff',
                }}>
                  {u.name.charAt(0)}
                </div>
                <span style={{ flex: 1, fontSize: '0.9rem', fontWeight: 500 }}>
                  {u.name}
                  {u.isUser && <span style={{ marginLeft: 6, padding: '2px 6px', borderRadius: 4, fontSize: '0.6rem', background: 'rgba(59,130,246,0.2)', color: '#3b82f6', fontWeight: 700 }}>YOU</span>}
                </span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-blue)' }}>
                  {Math.floor(Math.random() * 8)} phases
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
