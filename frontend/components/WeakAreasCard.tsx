'use client';

interface Props {
  weakTopics: { topic: string; score: number; trend: 'up' | 'down' | 'stable' }[];
  onFocusQuiz?: (topic: string) => void;
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 100);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const w = 60;
  const h = 20;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={w} height={h} style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <polyline
        points={points}
        fill="none"
        stroke="rgba(99,102,241,0.7)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function WeakAreasCard({ weakTopics, onFocusQuiz }: Props) {
  if (weakTopics.length === 0) return null;

  const trendIcon = (t: string) => {
    if (t === 'up') return '↗';
    if (t === 'down') return '↘';
    return '→';
  };

  const trendColor = (t: string) => {
    if (t === 'up') return '#10b981';
    if (t === 'down') return '#ef4444';
    return '#f59e0b';
  };

  return (
    <div className="glass-card" style={{ padding: 20, marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: '1.2rem' }}>⚠️</span>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f59e0b' }}>Weak Areas Detected</h3>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {weakTopics.map((wt, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 14px', borderRadius: 10,
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid var(--border-subtle)',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 500, marginBottom: 4 }}>{wt.topic}</div>
              <div style={{
                height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.06)',
              }}>
                <div style={{
                  height: '100%', borderRadius: 4, width: `${wt.score}%`,
                  background: wt.score < 40 ? '#ef4444' : wt.score < 70 ? '#f59e0b' : '#10b981',
                  transition: 'width 0.5s',
                }} />
              </div>
            </div>
            <Sparkline values={[
              Math.max(0, wt.score - 15),
              Math.max(0, wt.score - 5),
              wt.score,
            ]} />
            <span style={{
              fontSize: '0.85rem', fontWeight: 600, color: trendColor(wt.trend),
            }}>
              {wt.score}% {trendIcon(wt.trend)}
            </span>
          </div>
        ))}
      </div>
      {onFocusQuiz && (
        <button
          onClick={() => onFocusQuiz(weakTopics[0]?.topic || '')}
          className="btn-gradient"
          style={{ marginTop: 16, width: '100%', padding: '10px 20px', fontSize: '0.9rem' }}
        >
          🎯 Start Focus Quiz
        </button>
      )}
    </div>
  );
}
