'use client';

import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import api, { KnowledgeGraph } from '@/lib/api';
import { HiOutlineShare, HiOutlineCamera, HiOutlineCheckCircle, HiOutlineXCircle } from 'react-icons/hi2';
import { CAREER_PATHS, getCareerData, calculateSkillGap } from '@/lib/careerData';
import { getUserProfile } from '@/lib/userProfile';
import { logActivity } from '@/lib/streakTracker';
import { useRouter } from 'next/navigation';

export default function KnowledgePage() {
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<'documents' | 'career'>('documents');
  const [careerKey, setCareerKey] = useState('');
  const [selectedCareerNode, setSelectedCareerNode] = useState<string | null>(null);
  const graphRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    logActivity('knowledge_visit');
    api.getKnowledgeGraph().then(setGraph).catch(console.error).finally(() => setLoading(false));
    const profile = getUserProfile();
    setCareerKey(profile.careerGoal || Object.keys(CAREER_PATHS)[0]);
  }, []);

  const getConnections = (nodeId: string) => {
    if (!graph) return [];
    return graph.edges
      .filter(e => e.source === nodeId || e.target === nodeId)
      .map(e => {
        const otherId = e.source === nodeId ? e.target : e.source;
        const otherNode = graph.nodes.find(n => n.id === otherId);
        return { ...e, node: otherNode };
      });
  };

  // Career graph data
  const career = getCareerData(careerKey);
  const profile = getUserProfile();
  const skillGap = career ? calculateSkillGap(profile.masteredSkills || [], career.requiredSkills) : { have: [], missing: [], percentage: 0 };

  const careerGraphData = career ? {
    career: career.title,
    skills: career.requiredSkills.map(skill => ({
      name: skill,
      status: skillGap.have.includes(skill) ? 'mastered' as const : 'not_started' as const,
      children: [
        { name: `${skill} Course`, type: 'course' },
        { name: `${skill} Project`, type: 'project' },
      ],
    })),
  } : null;

  const handleExportImage = async () => {
    if (!graphRef.current) return;
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(graphRef.current, { backgroundColor: '#0a0b1a' });
      const link = document.createElement('a');
      link.download = 'career-graph.png';
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const nodeColor = (status: string) => {
    if (status === 'mastered') return { bg: 'rgba(16,185,129,0.12)', border: '#10b981', text: '#10b981' };
    if (status === 'in_progress') return { bg: 'rgba(245,158,11,0.12)', border: '#f59e0b', text: '#f59e0b' };
    return { bg: 'rgba(100,116,139,0.12)', border: '#64748b', text: '#94a3b8' };
  };

  const tabs = [
    { key: 'documents' as const, label: 'My Documents' },
    { key: 'career' as const, label: 'Career Graph' },
  ];

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 4 }}>Knowledge Graph</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Visualize connections between concepts across all your documents
        </p>
      </div>

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

      {/* Documents Tab — existing graph */}
      {tab === 'documents' && (
        <>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Loading...</div>
          ) : !graph || graph.nodes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <HiOutlineShare size={60} style={{ margin: '0 auto 16px', opacity: 0.2, color: 'var(--text-muted)' }} />
              <p style={{ fontSize: '1.1rem', fontWeight: 500, color: 'var(--text-muted)' }}>No knowledge graph yet</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
                Upload documents first — concepts will be auto-extracted and connected
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24 }}>
              {/* Graph Visualization */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="glass-card" style={{ padding: 24, minHeight: 500 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div>
                    <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 500, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', marginRight: 8 }}>
                      📄 {graph.stats.documents} docs
                    </span>
                    <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 500, background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', marginRight: 8 }}>
                      💡 {graph.stats.concepts} concepts
                    </span>
                    <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 500, background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
                      🔗 {graph.stats.total_edges} connections
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', alignItems: 'center', minHeight: 400, padding: 20 }}>
                  {graph.nodes.map((node, i) => {
                    const isSelected = selected === node.id;
                    const isConnected = selected
                      ? graph.edges.some(e => (e.source === selected && e.target === node.id) || (e.target === selected && e.source === node.id))
                      : false;
                    const dimmed = selected && !isSelected && !isConnected;

                    return (
                      <motion.button
                        key={node.id}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: dimmed ? 0.3 : 1 }}
                        transition={{ delay: i * 0.03, type: 'spring' }}
                        onClick={() => setSelected(isSelected ? null : node.id)}
                        style={{
                          padding: `${8 + node.size / 5}px ${12 + node.size / 3}px`,
                          borderRadius: node.type === 'document' ? 12 : 20,
                          background: isSelected ? `${node.color}30` : `${node.color}10`,
                          border: `2px solid ${isSelected ? node.color : isConnected ? `${node.color}60` : `${node.color}20`}`,
                          color: isSelected ? node.color : 'var(--text-secondary)',
                          cursor: 'pointer', fontFamily: 'inherit',
                          fontSize: `${0.75 + node.size / 60}rem`,
                          fontWeight: node.type === 'document' ? 600 : 400,
                          transition: 'all 0.3s',
                          boxShadow: isSelected ? `0 0 20px ${node.color}30` : 'none',
                        }}
                      >
                        {node.type === 'document' ? '📄 ' : ''}{node.label}
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>

              {/* Details Panel */}
              <div>
                {selected ? (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                    className="glass-card" style={{ padding: 20 }}>
                    {(() => {
                      const node = graph.nodes.find(n => n.id === selected);
                      const connections = getConnections(selected);
                      if (!node) return null;
                      return (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                            <div style={{ width: 12, height: 12, borderRadius: node.type === 'document' ? 4 : '50%', background: node.color }} />
                            <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>{node.label}</h3>
                          </div>
                          <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: '0.75rem', background: `${node.color}15`, color: node.color }}>
                            {node.type}
                          </span>
                          <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginTop: 20, marginBottom: 10 }}>
                            Connections ({connections.length})
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {connections.map((conn, i) => (
                              <button key={i} onClick={() => conn.node && setSelected(conn.node.id)}
                                style={{
                                  padding: '8px 12px', borderRadius: 8, textAlign: 'left',
                                  background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)',
                                  cursor: 'pointer', color: 'inherit', fontFamily: 'inherit', fontSize: '0.85rem',
                                }}>
                                <span style={{ color: conn.node?.color || 'var(--text-secondary)' }}>{conn.node?.label}</span>
                                <span style={{ float: 'right', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{conn.label} ({conn.weight})</span>
                              </button>
                            ))}
                          </div>
                        </>
                      );
                    })()}
                  </motion.div>
                ) : (
                  <div className="glass-card" style={{ padding: 20, textAlign: 'center' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Click a node to see its connections</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Career Graph Tab */}
      {tab === 'career' && careerGraphData && (
        <div>
          {/* Career selector + actions */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
            <select
              value={careerKey}
              onChange={e => { setCareerKey(e.target.value); setSelectedCareerNode(null); }}
              className="glass-input"
              style={{ flex: 1, cursor: 'pointer' }}
            >
              {Object.keys(CAREER_PATHS).map(k => (
                <option key={k} value={k} style={{ background: '#161836', color: '#f1f5f9' }}>{k}</option>
              ))}
            </select>
            <button onClick={handleExportImage} style={{
              padding: '10px 16px', borderRadius: 10, cursor: 'pointer',
              background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)', fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <HiOutlineCamera size={16} /> Export
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24 }}>
            {/* Career Graph SVG */}
            <div ref={graphRef} className="glass-card" style={{ padding: 32, minHeight: 500, overflowX: 'auto' }}>
              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                {/* Career Node (Level 1) */}
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 10,
                    padding: '14px 28px', borderRadius: 16,
                    background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(139,92,246,0.15))',
                    border: '2px solid rgba(99,102,241,0.3)',
                    fontSize: '1.1rem', fontWeight: 700, cursor: 'pointer',
                  }}
                  onClick={() => setSelectedCareerNode('career')}
                >
                  🎯 {careerGraphData.career}
                </motion.div>

                {/* Connecting line */}
                <div style={{ width: 2, height: 32, background: 'rgba(255,255,255,0.1)', margin: '0 auto' }} />

                {/* Skills (Level 2) */}
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginBottom: 24 }}>
                  {careerGraphData.skills.map((skill, i) => {
                    const nc = nodeColor(skill.status);
                    const isSelected = selectedCareerNode === skill.name;
                    return (
                      <motion.button
                        key={skill.name}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: i * 0.05 }}
                        onClick={() => setSelectedCareerNode(skill.name)}
                        style={{
                          padding: '10px 18px', borderRadius: 12,
                          background: isSelected ? `${nc.border}20` : nc.bg,
                          border: `2px solid ${isSelected ? nc.border : `${nc.border}40`}`,
                          color: nc.text, cursor: 'pointer',
                          fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 600,
                          transition: 'all 0.2s',
                          boxShadow: isSelected ? `0 0 16px ${nc.border}25` : 'none',
                        }}
                      >
                        {skill.status === 'mastered' ? '✅ ' : '⬜ '}{skill.name}
                      </motion.button>
                    );
                  })}
                </div>

                {/* Level 3: Courses + Projects for selected skill */}
                {selectedCareerNode && selectedCareerNode !== 'career' && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <div style={{ width: 2, height: 24, background: 'rgba(255,255,255,0.06)', margin: '0 auto' }} />
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 12 }}>
                      {careerGraphData.skills.find(s => s.name === selectedCareerNode)?.children.map((child, i) => (
                        <div key={i} style={{
                          padding: '10px 16px', borderRadius: 10,
                          background: child.type === 'course' ? 'rgba(59,130,246,0.08)' : 'rgba(245,158,11,0.08)',
                          border: `1px solid ${child.type === 'course' ? 'rgba(59,130,246,0.2)' : 'rgba(245,158,11,0.2)'}`,
                          fontSize: '0.8rem', color: 'var(--text-secondary)',
                        }}>
                          {child.type === 'course' ? '📚 ' : '🛠️ '}{child.name}
                        </div>
                      ))}
                      <div style={{
                        padding: '10px 16px', borderRadius: 10,
                        background: 'rgba(16,185,129,0.08)',
                        border: '1px solid rgba(16,185,129,0.2)',
                        fontSize: '0.8rem', color: 'var(--text-secondary)',
                      }}>
                        💼 Internship
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Legend */}
                <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 32, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: '#10b981' }} /> Mastered
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: '#f59e0b' }} /> In Progress
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: '#64748b' }} /> Not Started
                  </span>
                </div>
              </div>
            </div>

            {/* Detail Panel */}
            <div>
              {selectedCareerNode ? (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                  className="glass-card" style={{ padding: 20 }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: 8 }}>
                    {selectedCareerNode === 'career' ? `🎯 ${careerGraphData.career}` : selectedCareerNode}
                  </h3>
                  {selectedCareerNode === 'career' ? (
                    <div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
                        A comprehensive career path requiring expertise in {career?.requiredSkills.length} key skills.
                        Current progress: {skillGap.percentage}% of skills matched.
                      </p>
                      <div className="progress-bar" style={{ height: 6, marginBottom: 12 }}>
                        <div className="progress-bar-fill" style={{ width: `${skillGap.percentage}%`, background: 'linear-gradient(90deg, #3b82f6, #10b981)' }} />
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {skillGap.have.length} of {career?.requiredSkills.length} skills
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                        {skillGap.have.includes(selectedCareerNode) ? (
                          <><HiOutlineCheckCircle size={16} color="#10b981" /><span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 600 }}>Mastered</span></>
                        ) : (
                          <><HiOutlineXCircle size={16} color="#64748b" /><span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>Not Started</span></>
                        )}
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
                        {selectedCareerNode} is a key skill required for the {careerGraphData.career} role. Build proficiency through courses and hands-on projects.
                      </p>
                      <button
                        onClick={() => router.push(`/roadmap?goal=${encodeURIComponent(selectedCareerNode)}`)}
                        className="btn-gradient"
                        style={{ width: '100%', padding: '10px', fontSize: '0.85rem' }}
                      >
                        Add to Roadmap
                      </button>
                    </div>
                  )}
                </motion.div>
              ) : (
                <div className="glass-card" style={{ padding: 20, textAlign: 'center' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Click a node to see details</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
