'use client';

import { useState, useEffect } from 'react';
import { getUserProfile, updateUserProfile } from '@/lib/userProfile';
import { PERSONA_LABELS } from '@/lib/personaPrompts';

interface Props {
  onChange?: (persona: string) => void;
}

export default function PersonaSelector({ onChange }: Props) {
  const [selected, setSelected] = useState('friendlyGuide');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const profile = getUserProfile();
    if (profile.persona) setSelected(profile.persona);
  }, []);

  const handleSelect = (key: string) => {
    setSelected(key);
    updateUserProfile({ persona: key });
    setOpen(false);
    onChange?.(key);
  };

  const current = PERSONA_LABELS[selected] || PERSONA_LABELS.friendlyGuide;

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 14px', borderRadius: 10,
          background: `${current.color}12`,
          border: `1px solid ${current.color}30`,
          color: current.color, cursor: 'pointer',
          fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 600,
          transition: 'all 0.2s',
        }}
      >
        <span>{current.emoji}</span>
        <span>{current.label}</span>
        <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>▾</span>
      </button>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 60 }}
          />
          <div style={{
            position: 'absolute', right: 0, top: '100%', marginTop: 6,
            background: 'rgba(22,24,54,0.98)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12, padding: 6, zIndex: 70,
            minWidth: 220, boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
          }}>
            {Object.entries(PERSONA_LABELS).map(([key, p]) => (
              <button
                key={key}
                onClick={() => handleSelect(key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '10px 14px', borderRadius: 8,
                  background: selected === key ? `${p.color}12` : 'transparent',
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                  color: selected === key ? p.color : 'var(--text-secondary)',
                  fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 500,
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>{p.emoji}</span>
                <span>{p.label}</span>
                {selected === key && (
                  <span style={{ marginLeft: 'auto', fontSize: '0.75rem', opacity: 0.7 }}>✓</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
