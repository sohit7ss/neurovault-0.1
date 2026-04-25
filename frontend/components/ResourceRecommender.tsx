'use client';

import { useState } from 'react';
import { RESOURCE_MAP, getResourcesForTopic, TopicResources } from '@/lib/resourceData';
import { HiOutlineBookOpen } from 'react-icons/hi2';

interface Props {
  subject?: string;
  careerGoal?: string;
}

export default function ResourceRecommender({ subject, careerGoal }: Props) {
  const [expanded, setExpanded] = useState(false);

  // Find matching topic
  const searchKey = subject || careerGoal || '';
  const topicRes = getResourcesForTopic(searchKey);

  if (!topicRes) return null;

  const allItems = [
    ...topicRes.youtube.map(r => ({ ...r, type: 'youtube' as const, color: '#ef4444', icon: '🎥', free: true })),
    ...topicRes.courses.map(r => ({ ...r, type: 'course' as const, color: '#3b82f6', icon: '📚', free: r.platform === 'freeCodeCamp' || r.platform === 'MIT OCW' })),
    { name: `${topicRes.book.name} by ${topicRes.book.author}`, url: '#', type: 'book' as const, color: '#f59e0b', icon: '📖', free: false },
  ];

  const displayed = expanded ? allItems : allItems.slice(0, 4);

  return (
    <div className="glass-card" style={{ padding: 20, marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          <HiOutlineBookOpen size={18} style={{ color: '#3b82f6' }} /> Recommended Resources
        </h3>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>~{topicRes.estHours}hrs to master</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {displayed.map((r, i) => (
          <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
            style={{
              display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 8,
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)',
              textDecoration: 'none', transition: 'all 0.15s',
            }}
            onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
            onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
          >
            <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{r.icon}</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.name}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: 3, background: `${r.color}15`, color: r.color, fontWeight: 600 }}>
                  {r.type}
                </span>
                {r.free && <span style={{ fontSize: '0.6rem', color: '#10b981', fontWeight: 600 }}>FREE</span>}
              </div>
            </div>
          </a>
        ))}
      </div>

      {allItems.length > 4 && (
        <button onClick={() => setExpanded(!expanded)}
          style={{
            width: '100%', marginTop: 8, padding: '6px', borderRadius: 6,
            background: 'none', border: '1px solid rgba(255,255,255,0.06)',
            color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'inherit',
          }}>
          {expanded ? 'Show Less' : `Show All ${allItems.length} Resources`}
        </button>
      )}
    </div>
  );
}
