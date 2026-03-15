'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api, { Roadmap, RoadmapPhase } from '@/lib/api';
import { 
  HiOutlineMap, HiOutlinePlus, HiOutlineCheckCircle, 
  HiOutlineChevronDown, HiOutlineChevronUp, HiOutlineGlobeAlt, 
  HiOutlineDocumentText, HiOutlineTrash, HiOutlineClock,
  HiOutlineVideoCamera, HiOutlineBookOpen, HiOutlineAcademicCap,
  HiOutlineCodeBracket, HiOutlineLink
} from 'react-icons/hi2';

const phaseColors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'];

const getResourceIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'video': return <HiOutlineVideoCamera />;
    case 'book':
    case 'article': return <HiOutlineBookOpen />;
    case 'course': return <HiOutlineAcademicCap />;
    case 'practice':
    case 'project': return <HiOutlineCodeBracket />;
    default: return <HiOutlineLink />;
  }
};

export default function RoadmapPage() {
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  // Form State
  const [goal, setGoal] = useState('');
  const [level, setLevel] = useState('beginner');
  const [time, setTime] = useState('2'); // default 2 hours/day
  const [generating, setGenerating] = useState(false);
  const [useDocuments, setUseDocuments] = useState(false);
  
  // Viewer State
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({});
  const [selectedRoadmap, setSelectedRoadmap] = useState<Roadmap | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchRoadmaps = async () => {
    try {
      const res = await api.getRoadmaps();
      setRoadmaps(res.roadmaps);
      if (res.roadmaps.length > 0 && !selectedRoadmap) {
        setSelectedRoadmap(res.roadmaps[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRoadmaps(); }, []);

  const handleGenerate = async () => {
    if (!goal.trim()) return;
    setGenerating(true);
    try {
      const timeStr = `${time} hours/day`;
      const rm = await api.generateRoadmap(goal, level, timeStr);
      setRoadmaps(prev => [rm, ...prev]);
      setSelectedRoadmap(rm);
      setShowForm(false);
      setGoal('');
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const togglePhase = (phaseId: string) => {
    setExpandedPhases(prev => ({ ...prev, [phaseId]: prev[phaseId] === undefined ? false : !prev[phaseId] }));
  };

  const toggleTopic = async (roadmapId: number, phaseId: string, topicIdx: number, current: boolean) => {
    try {
      const updated = await api.updateRoadmapProgress(roadmapId, phaseId, topicIdx, !current);
      setSelectedRoadmap(updated);
      setRoadmaps(prev => prev.map(r => r.id === updated.id ? updated : r));
    } catch (err) {
      console.error(err);
    }
  };

  const deleteRoadmap = async () => {
    if (!selectedRoadmap || !confirm('Are you sure you want to delete this roadmap?')) return;
    setDeleting(true);
    try {
      await api.deleteRoadmap(selectedRoadmap.id);
      setRoadmaps(prev => prev.filter(r => r.id !== selectedRoadmap.id));
      setSelectedRoadmap(roadmaps.length > 1 ? roadmaps[0] : null);
    } catch (err) {
      console.error(err);
      alert('Failed to delete roadmap');
    } finally {
      setDeleting(false);
    }
  };

  const calculateTotalDays = (totalHours?: number) => {
    if (!totalHours) return 0;
    const hoursPerDay = parseFloat(time) || 2;
    return Math.ceil(totalHours / hoursPerDay);
  };

  return (
    <div style={{ paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 4 }}>Learning Roadmaps</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            AI-generated personalized learning paths with resource tracking
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-gradient"
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px' }}>
          {showForm ? 'Cancel' : <><HiOutlinePlus size={18} /> New Roadmap</>}
        </button>
      </div>

      {/* Generate Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
            <div className="glass-card" style={{ padding: 24, marginBottom: 24, position: 'relative', zIndex: 5 }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Generate Dynamic Roadmap</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 6 }}>Learning Goal</label>
                  <input value={goal} onChange={e => setGoal(e.target.value)} placeholder="e.g. Master React, Learn Python..."
                    className="glass-input" style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 6 }}>Experience Level</label>
                  <select value={level} onChange={e => setLevel(e.target.value)} className="glass-input" style={{ width: '100%' }}>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 6 }}>Study Scheduler (Hours/Day)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="range" min="1" max="8" value={time} onChange={e => setTime(e.target.value)} style={{ flex: 1, accentColor: 'var(--accent-blue)' }} />
                    <span style={{ fontSize: '0.9rem', width: 24, fontWeight: 600 }}>{time}h</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Source Base:</span>
                  <div style={{ display: 'flex', borderRadius: 8, border: '1px solid var(--border-default)', overflow: 'hidden' }}>
                    <button type="button" onClick={() => setUseDocuments(false)}
                      style={{ padding: '8px 14px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 5, background: !useDocuments ? 'rgba(59,130,246,0.15)' : 'transparent', color: !useDocuments ? 'var(--accent-blue)' : 'var(--text-muted)', border: 'none', borderRight: '1px solid var(--border-default)' }}>
                      <HiOutlineGlobeAlt size={14} /> Web Knowledge
                    </button>
                    <button type="button" onClick={() => setUseDocuments(true)}
                      style={{ padding: '8px 14px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 5, background: useDocuments ? 'rgba(139,92,246,0.15)' : 'transparent', color: useDocuments ? 'var(--accent-purple)' : 'var(--text-muted)', border: 'none' }}>
                      <HiOutlineDocumentText size={14} /> My Documents
                    </button>
                  </div>
                </div>

                <button onClick={handleGenerate} disabled={generating || !goal.trim()} className="btn-gradient"
                  style={{ 
                    padding: '12px 28px', 
                    opacity: generating || !goal.trim() ? 0.6 : 1, 
                    whiteSpace: 'nowrap',
                    cursor: generating || !goal.trim() ? 'not-allowed' : 'pointer',
                    position: 'relative',
                    zIndex: 10
                  }}>
                  {generating ? 'Generating Syllabus...' : '🚀 Create Journey'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      {loading ? (
        <div className="shimmer-bg" style={{ height: 400, borderRadius: 16 }} />
      ) : roadmaps.length === 0 && !showForm ? (
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <HiOutlineMap size={64} style={{ margin: '0 auto 16px', opacity: 0.2, color: 'var(--text-primary)' }} />
          <p style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>No roadmaps yet</p>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginBottom: 24, maxWidth: 300, margin: '0 auto 24px' }}>Let AI generate a customized, day-by-day learning plan to master any topic.</p>
          <button onClick={() => setShowForm(true)} className="btn-gradient" style={{ padding: '12px 28px' }}>Create First Roadmap</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 300px) 1fr', gap: 24, alignItems: 'start' }}>
          
          {/* Sidebar: Roadmap List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 20 }}>
            <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>My Journeys</h3>
            {roadmaps.map(rm => (
              <button key={rm.id} onClick={() => setSelectedRoadmap(rm)}
                style={{
                  padding: '16px', borderRadius: 12, textAlign: 'left', cursor: 'pointer',
                  background: selectedRoadmap?.id === rm.id ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${selectedRoadmap?.id === rm.id ? 'rgba(59,130,246,0.3)' : 'var(--border-subtle)'}`,
                  color: 'inherit', fontFamily: 'inherit', transition: 'all 0.2s',
                  boxShadow: selectedRoadmap?.id === rm.id ? '0 4px 12px rgba(0,0,0,0.2)' : 'none'
                }}>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 8, lineHeight: 1.3 }}>{rm.roadmap_data.title || rm.goal}</div>
                <div className="progress-bar" style={{ marginBottom: 8, height: 6, background: 'rgba(0,0,0,0.3)' }}>
                  <div className="progress-bar-fill" style={{ width: `${rm.progress || 0}%`, background: `linear-gradient(90deg, #3b82f6, #8b5cf6)` }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span>{Math.round(rm.progress || 0)}% Complete</span>
                  <span style={{ textTransform: 'capitalize' }}>{rm.level}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Main: Roadmap Detail */}
          {selectedRoadmap && selectedRoadmap.roadmap_data && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              
              {/* Detail Header */}
              <div className="glass-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 6 }}>{selectedRoadmap.roadmap_data.title || selectedRoadmap.goal}</h2>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      <span style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: 6, textTransform: 'capitalize' }}>Level: {selectedRoadmap.level}</span>
                      <span style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: 6 }}><HiOutlineClock style={{display:'inline', marginBottom:-2}}/> Pace: {selectedRoadmap.time_available}</span>
                      {selectedRoadmap.roadmap_data.total_estimated_hours && (
                        <span style={{ background: 'rgba(139,92,246,0.1)', color: 'var(--accent-purple)', padding: '4px 10px', borderRadius: 6 }}>
                          Est. Total: {selectedRoadmap.roadmap_data.total_estimated_hours} hrs
                          (~{calculateTotalDays(selectedRoadmap.roadmap_data.total_estimated_hours)} days)
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={deleteRoadmap} disabled={deleting} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}>
                    <HiOutlineTrash /> Delete
                  </button>
                </div>
                
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 6, fontWeight: 500 }}>
                    <span>Overall Progress</span>
                    <span style={{ color: 'var(--accent-blue)' }}>{Math.round(selectedRoadmap.progress || 0)}%</span>
                  </div>
                  <div className="progress-bar" style={{ height: 10, background: 'rgba(0,0,0,0.3)' }}>
                    <div className="progress-bar-fill" style={{ width: `${selectedRoadmap.progress || 0}%`, background: `linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)` }} />
                  </div>
                </div>
              </div>

              {/* Visual Timeline Header */}
              <div className="glass-card" style={{ padding: '24px 20px', overflowX: 'auto', display: 'flex', gap: 0, alignItems: 'center' }}>
                {selectedRoadmap.roadmap_data.phases?.map((phase, i, arr) => {
                  const color = phaseColors[i % phaseColors.length];
                  const completedTopics = phase.topics?.filter(t => t.completed).length || 0;
                  const total = phase.topics?.length || 1;
                  const phaseProgress = completedTopics / total;
                  const isDone = phaseProgress === 1;
                  
                  return (
                    <div key={phase.id} style={{ display: 'flex', alignItems: 'center', minWidth: 120 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, position: 'relative', zIndex: 2 }}>
                        <div style={{ 
                          width: 32, height: 32, borderRadius: '50%', background: isDone ? color : 'var(--bg-card)', 
                          border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: isDone ? '#fff' : color, fontWeight: 700, fontSize: '0.9rem'
                        }}>
                          {isDone ? <HiOutlineCheckCircle size={20} /> : i + 1}
                        </div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Phase {i + 1}</div>
                      </div>
                      {i < arr.length - 1 && (
                        <div style={{ height: 3, flex: 1, background: 'var(--border-subtle)', margin: '0 8px', position: 'relative', top: -10, minWidth: 40 }}>
                          <div style={{ height: '100%', background: color, width: `${phaseProgress * 100}%`, transition: 'width 0.3s' }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Phases and Topics */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {selectedRoadmap.roadmap_data.phases?.map((phase, pi) => {
                  const color = phaseColors[pi % phaseColors.length];
                  const isExpanded = expandedPhases[phase.id] !== false; // default expanded
                  const completedTopics = phase.topics?.filter(t => t.completed).length || 0;
                  const totalTopics = phase.topics?.length || 0;
                  const status = completedTopics === 0 ? 'Not Started' : completedTopics === totalTopics ? 'Completed' : 'In Progress';

                  return (
                    <motion.div key={phase.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: pi * 0.05 }} className="glass-card" style={{ overflow: 'hidden', borderLeft: `4px solid ${color}` }}>
                      
                      {/* Phase Header */}
                      <button onClick={() => togglePhase(phase.id)}
                        style={{
                          width: '100%', padding: '20px 24px', display: 'flex', alignItems: 'flex-start',
                          justifyContent: 'space-between', cursor: 'pointer', background: 'none',
                          border: 'none', color: 'inherit', fontFamily: 'inherit', textAlign: 'left',
                        }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                          <div style={{
                            width: 44, height: 44, borderRadius: 12,
                            background: `${color}15`, display: 'flex', alignItems: 'center',
                            justifyContent: 'center', fontSize: '1rem', fontWeight: 700, color,
                          }}>{pi + 1}</div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                              <h3 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0 }}>{phase.title}</h3>
                              <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{status}</span>
                            </div>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.4 }}>{phase.description}</p>
                            <div style={{ display: 'flex', gap: 16, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              <span><HiOutlineClock style={{display:'inline', marginBottom:-2}}/> {phase.duration} {phase.estimated_hours && `(~${phase.estimated_hours} hrs)`}</span>
                              <span>•</span>
                              <span>{completedTopics}/{totalTopics} Topics</span>
                            </div>
                          </div>
                        </div>
                        <div style={{ color: 'var(--text-muted)' }}>
                          {isExpanded ? <HiOutlineChevronUp size={22} /> : <HiOutlineChevronDown size={22} />}
                        </div>
                      </button>

                      {/* Phase Topics */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                            <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid var(--border-subtle)', paddingTop: 20 }}>
                              {/* Phase prerequisites */}
                              {(phase as any).prerequisites && (
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 8, padding: '8px 12px', marginBottom: 4 }}>
                                  <strong style={{ color: '#f59e0b' }}>Prerequisites:</strong> {(phase as any).prerequisites}
                                </div>
                              )}
                              {phase.topics?.map((topic: any, ti: number) => (
                                <div key={ti} style={{
                                  borderRadius: 12,
                                  background: topic.completed ? `${color}08` : 'rgba(255,255,255,0.02)',
                                  border: `1px solid ${topic.completed ? `${color}30` : 'var(--border-subtle)'}`,
                                  transition: 'all 0.2s',
                                  overflow: 'hidden'
                                }}>
                                  <button onClick={() => toggleTopic(selectedRoadmap.id, phase.id, ti, topic.completed)}
                                    style={{
                                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                      padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer',
                                      color: 'inherit', fontFamily: 'inherit', textAlign: 'left', width: '100%',
                                    }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                      <HiOutlineCheckCircle size={22} style={{ color: topic.completed ? color : 'var(--text-muted)', transition: 'color 0.2s', flexShrink: 0 }} />
                                      <div>
                                        <span style={{ fontSize: '0.95rem', fontWeight: 500, textDecoration: topic.completed ? 'line-through' : 'none', color: topic.completed ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                                          {topic.title}
                                        </span>
                                        {topic.description && (
                                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>
                                            {topic.description}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                      {topic.difficulty && (
                                        <span style={{
                                          fontSize: '0.7rem', padding: '2px 8px', borderRadius: 4, fontWeight: 600, textTransform: 'uppercase',
                                          background: topic.difficulty === 'easy' ? 'rgba(16,185,129,0.12)' : topic.difficulty === 'medium' ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
                                          color: topic.difficulty === 'easy' ? '#10b981' : topic.difficulty === 'medium' ? '#f59e0b' : '#ef4444',
                                        }}>
                                          {topic.difficulty}
                                        </span>
                                      )}
                                      {topic.estimated_hours && (
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', padding: '2px 8px', borderRadius: 4 }}>
                                          {topic.estimated_hours}h
                                        </span>
                                      )}
                                    </div>
                                  </button>

                                  {/* Subtopics */}
                                  {topic.subtopics && topic.subtopics.length > 0 && (
                                    <div style={{ padding: '0 16px 10px 48px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                      {topic.subtopics.map((sub: string, si: number) => (
                                        <span key={si} style={{
                                          fontSize: '0.72rem', padding: '3px 10px', borderRadius: 20,
                                          background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)',
                                          color: 'var(--text-secondary)',
                                        }}>
                                          {sub}
                                        </span>
                                      ))}
                                    </div>
                                  )}

                                  {/* Resources Panel */}
                                  {topic.resources && topic.resources.length > 0 && (
                                    <div style={{ padding: '0 16px 12px 48px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                      {topic.resources.map((res: any, ri: number) => (
                                        <a key={ri} href={res.url || '#'} target="_blank" rel="noopener noreferrer"
                                          style={{
                                            display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem',
                                            color: 'var(--text-secondary)', textDecoration: 'none', padding: '6px 10px',
                                            background: 'rgba(255,255,255,0.03)', borderRadius: 6, transition: 'background 0.2s'
                                          }} 
                                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                                          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                        >
                                          <span style={{ color: color }}>{getResourceIcon(res.type)}</span>
                                          <span style={{ flex: 1 }}>{res.title}</span>
                                          <span style={{ fontSize: '0.7rem', opacity: 0.5, textTransform: 'capitalize' }}>{res.type}</span>
                                          {res.url && res.url !== '#' && (
                                            <HiOutlineLink size={12} style={{ opacity: 0.4 }} />
                                          )}
                                        </a>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                    </motion.div>
                  );
                })}
              </div>

            </div>
          )}
        </div>
      )}
    </div>
  );
}
