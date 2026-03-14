'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import api, { KnowledgeGraph } from '@/lib/api';
import { HiOutlineShare } from 'react-icons/hi2';

export default function KnowledgePage() {
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    api.getKnowledgeGraph().then(setGraph).catch(console.error).finally(() => setLoading(false));
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

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 4 }}>Knowledge Graph</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Visualize connections between concepts across all your documents
        </p>
      </div>

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
                <span style={{
                  padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 500,
                  background: 'rgba(59,130,246,0.1)', color: '#3b82f6', marginRight: 8,
                }}>
                  📄 {graph.stats.documents} docs
                </span>
                <span style={{
                  padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 500,
                  background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', marginRight: 8,
                }}>
                  💡 {graph.stats.concepts} concepts
                </span>
                <span style={{
                  padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 500,
                  background: 'rgba(16,185,129,0.1)', color: '#10b981',
                }}>
                  🔗 {graph.stats.total_edges} connections
                </span>
              </div>
            </div>

            {/* Node Cloud */}
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center',
              alignItems: 'center', minHeight: 400, padding: 20,
            }}>
              {graph.nodes.map((node, i) => {
                const isSelected = selected === node.id;
                const isConnected = selected
                  ? graph.edges.some(
                      e => (e.source === selected && e.target === node.id) ||
                           (e.target === selected && e.source === node.id)
                    )
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
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
                      }}>
                        <div style={{
                          width: 12, height: 12, borderRadius: node.type === 'document' ? 4 : '50%',
                          background: node.color,
                        }} />
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>{node.label}</h3>
                      </div>
                      <span style={{
                        padding: '3px 8px', borderRadius: 6, fontSize: '0.75rem',
                        background: `${node.color}15`, color: node.color,
                      }}>
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
                              cursor: 'pointer', color: 'inherit', fontFamily: 'inherit',
                              fontSize: '0.85rem',
                            }}>
                            <span style={{ color: conn.node?.color || 'var(--text-secondary)' }}>
                              {conn.node?.label}
                            </span>
                            <span style={{ float: 'right', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {conn.label} ({conn.weight})
                            </span>
                          </button>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </motion.div>
            ) : (
              <div className="glass-card" style={{ padding: 20, textAlign: 'center' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Click a node to see its connections
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
