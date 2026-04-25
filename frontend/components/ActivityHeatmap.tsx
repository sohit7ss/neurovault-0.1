'use client';

import { useState } from 'react';

interface Props {
  data: { date: string; count: number }[];
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function ActivityHeatmap({ data }: Props) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  const cellSize = 13;
  const cellGap = 3;
  const totalSize = cellSize + cellGap;

  // 365 days → 52 full weeks + remainder
  const weeks: { date: string; count: number }[][] = [];
  let currentWeek: { date: string; count: number }[] = [];

  // Pad start to align with correct day of week
  const firstDate = data.length > 0 ? new Date(data[0].date) : new Date();
  const startDay = firstDate.getDay(); // 0=Sun

  for (let i = 0; i < startDay; i++) {
    currentWeek.push({ date: '', count: -1 }); // placeholder
  }

  data.forEach(d => {
    currentWeek.push(d);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });
  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  const getColor = (count: number): string => {
    if (count <= 0) return 'rgba(255,255,255,0.03)';
    if (count <= 2) return 'rgba(59,130,246,0.25)';
    if (count <= 5) return 'rgba(99,102,241,0.45)';
    return 'rgba(99,102,241,0.75)';
  };

  // Calculate month label positions
  const monthLabels: { label: string; col: number }[] = [];
  let lastMonth = -1;
  weeks.forEach((week, wi) => {
    const validDay = week.find(d => d.date !== '');
    if (validDay && validDay.date) {
      const m = new Date(validDay.date).getMonth();
      if (m !== lastMonth) {
        monthLabels.push({ label: MONTHS[m], col: wi });
        lastMonth = m;
      }
    }
  });

  const svgWidth = weeks.length * totalSize + 10;
  const svgHeight = 7 * totalSize + 24;

  return (
    <div style={{ position: 'relative', overflowX: 'auto' }}>
      <svg width={svgWidth} height={svgHeight} style={{ display: 'block' }}>
        {/* Month labels */}
        {monthLabels.map((ml, i) => (
          <text
            key={i}
            x={ml.col * totalSize + 2}
            y={10}
            fill="var(--text-muted)"
            fontSize="10"
            fontFamily="Inter, sans-serif"
          >
            {ml.label}
          </text>
        ))}

        {/* Cells */}
        {weeks.map((week, wi) =>
          week.map((day, di) => {
            if (day.count < 0) return null;
            return (
              <rect
                key={`${wi}-${di}`}
                x={wi * totalSize + 2}
                y={di * totalSize + 16}
                width={cellSize}
                height={cellSize}
                rx={3}
                fill={getColor(day.count)}
                style={{ transition: 'fill 0.2s', cursor: 'pointer' }}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setTooltip({
                    x: rect.left,
                    y: rect.top - 36,
                    text: day.date
                      ? `${day.date}: ${day.count} activit${day.count === 1 ? 'y' : 'ies'}`
                      : '',
                  });
                }}
                onMouseLeave={() => setTooltip(null)}
              />
            );
          })
        )}
      </svg>

      {/* Legend */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end',
        marginTop: 8, fontSize: '0.7rem', color: 'var(--text-muted)',
      }}>
        <span>Less</span>
        {[0, 1, 3, 6].map((v, i) => (
          <div
            key={i}
            style={{
              width: 12, height: 12, borderRadius: 3,
              background: getColor(v),
            }}
          />
        ))}
        <span>More</span>
      </div>

      {/* Tooltip */}
      {tooltip && tooltip.text && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x, top: tooltip.y,
            background: 'rgba(10,11,26,0.95)',
            border: '1px solid rgba(255,255,255,0.1)',
            padding: '4px 10px', borderRadius: 6,
            fontSize: '0.75rem', color: 'var(--text-primary)',
            pointerEvents: 'none', zIndex: 100, whiteSpace: 'nowrap',
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
