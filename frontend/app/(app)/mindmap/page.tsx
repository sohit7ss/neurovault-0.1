'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ReactFlow,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  ConnectionLineType,
  Panel,
  useReactFlow,
  ReactFlowProvider,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { toPng } from 'html-to-image';
import {
  HiOutlineLightBulb, HiOutlineDocumentText, HiOutlineGlobeAlt,
  HiOutlinePlus, HiOutlinePencilSquare, HiOutlineTrash,
  HiOutlineFolderArrowDown, HiOutlinePlay, HiOutlineArrowsPointingOut,
  HiOutlineXMark, HiOutlineMap
} from 'react-icons/hi2';
import api, { MindMapNode, SavedMindMap } from '@/lib/api';

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction, nodesep: 50, ranksep: 200 });

  nodes.forEach((node) => {
    // estimate dimensions based on label length
    const width = 180;
    const height = 50;
    dagreGraph.setNode(node.id, { width, height });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const newNode = { ...node };

    newNode.targetPosition = isHorizontal ? Position.Left : Position.Top;
    newNode.sourcePosition = isHorizontal ? Position.Right : Position.Bottom;
    newNode.position = {
      x: nodeWithPosition.x - 180 / 2,
      y: nodeWithPosition.y - 50 / 2,
    };

    return newNode;
  });

  return { nodes: newNodes, edges };
};

// Convert nested API structure to flat React Flow nodes & edges
const convertMindMapToFlow = (root: MindMapNode) => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  
  const traverse = (node: MindMapNode, depth = 0, parentId: string | null = null, index = 0) => {
    const id = node.id || `node-${depth}-${index}-${Math.random().toString(36).substr(2, 9)}`;
    const colorClass = depth === 0 ? '#3b82f6' : depth === 1 ? '#8b5cf6' : depth === 2 ? '#10b981' : '#f59e0b';
    
    nodes.push({
      id,
      data: { label: node.label, depth },
      position: { x: 0, y: 0 },
      style: {
        background: `linear-gradient(135deg, rgba(10, 11, 26, 0.9), rgba(16, 18, 40, 0.9))`,
        border: `1px solid ${colorClass}50`,
        borderRadius: '12px',
        padding: '12px 20px',
        color: '#f1f5f9',
        fontSize: depth === 0 ? '16px' : depth === 1 ? '14px' : '12px',
        fontWeight: depth === 0 ? 700 : 500,
        boxShadow: depth === 0 ? `0 0 20px ${colorClass}40` : `0 4px 12px rgba(0,0,0,0.2)`,
        minWidth: 150,
      },
      type: 'default',
    });

    if (parentId) {
      edges.push({
        id: `e-${parentId}-${id}`,
        source: parentId,
        target: id,
        type: 'smoothstep',
        animated: depth <= 1,
        style: { stroke: colorClass, strokeWidth: depth === 1 ? 3 : 2 },
      });
    }

    if (node.children) {
      node.children.forEach((child, i) => traverse(child, depth + 1, id, i));
    }
  };

  traverse(root);
  return getLayoutedElements(nodes, edges);
};

// Helper: Convert React Flow nodes back to nested MindMapNode
const convertFlowToMindMap = (nodes: Node[], edges: Edge[]): MindMapNode => {
  if (nodes.length === 0) return { id: 'root', label: 'Empty', children: [] };
  
  // Find root (node with no incoming edges)
  const targets = new Set(edges.map(e => e.target));
  const rootNode = nodes.find(n => !targets.has(n.id)) || nodes[0];
  
  const buildTree = (nodeId: string): MindMapNode => {
    const n = nodes.find(x => x.id === nodeId);
    const childrenEdges = edges.filter(e => e.source === nodeId);
    return {
      id: nodeId,
      label: n?.data.label as string || 'Topic',
      children: childrenEdges.map(e => buildTree(e.target))
    };
  };
  
  return buildTree(rootNode.id);
};

function FlowApp() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  
  // UI states
  const [topic, setTopic] = useState('');
  const [depth, setDepth] = useState(3);
  const [useDocuments, setUseDocuments] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Saved maps
  const [savedMaps, setSavedMaps] = useState<SavedMindMap[]>([]);
  const [currentMapId, setCurrentMapId] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  
  // Node actions
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explaining, setExplaining] = useState(false);
  
  const { fitView } = useReactFlow();
  const flowWrapper = useRef<HTMLDivElement>(null);

  const onNodesChange = useCallback((changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);

  const loadHistory = async () => {
    try {
      const res = await api.getMindMaps();
      setSavedMaps(res.mindmaps);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { loadHistory(); }, []);

  const generateMap = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setExplanation(null);
    setCurrentMapId(null);
    try {
      const data = await api.generateMindMap(topic, useDocuments, depth);
      const { nodes: initNodes, edges: initEdges } = convertMindMapToFlow(data);
      setNodes(initNodes);
      setEdges(initEdges);
      setTimeout(() => fitView({ padding: 0.2, duration: 800 }), 100);
      
      // Auto save
      const saved = await api.saveMindMap(`Mind Map: ${topic}`, topic, data);
      setCurrentMapId(saved.id);
      loadHistory();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadMap = (map: SavedMindMap) => {
    const { nodes: initNodes, edges: initEdges } = convertMindMapToFlow(map.mindmap_data);
    setNodes(initNodes);
    setEdges(initEdges);
    setTopic(map.topic);
    setCurrentMapId(map.id);
    setSelectedNode(null);
    setExplanation(null);
    setShowHistory(false);
    setTimeout(() => fitView({ padding: 0.2, duration: 800 }), 100);
  };

  const updateCurrentMap = async (newNodes: Node[], newEdges: Edge[]) => {
    if (!currentMapId) return;
    const tree = convertFlowToMindMap(newNodes, newEdges);
    try {
      await api.updateMindMap(currentMapId, undefined, tree);
      loadHistory();
    } catch (err) {
      console.error("Failed to update map", err);
    }
  };

  const explainNode = async (node: Node) => {
    setExplaining(true);
    setExplanation(null);
    try {
      const res = await api.explainConcept(node.data.label as string, useDocuments);
      setExplanation(res.explanation);
    } catch (err) {
      console.error(err);
    } finally {
      setExplaining(false);
    }
  };

  // Node Editing
  const addChild = () => {
    if (!selectedNode) return;
    const id = `node-${Date.now()}`;
    const parentDepth = (selectedNode.data.depth as number) || 0;
    const colorClass = parentDepth + 1 === 1 ? '#8b5cf6' : parentDepth + 1 === 2 ? '#10b981' : '#f59e0b';
    
    const newNode: Node = {
      id,
      position: { x: selectedNode.position.x + 250, y: selectedNode.position.y + 50 },
      data: { label: 'New Topic', depth: parentDepth + 1 },
      style: selectedNode.style,
      type: 'default',
    };
    
    const newEdge: Edge = {
      id: `e-${selectedNode.id}-${id}`,
      source: selectedNode.id,
      target: id,
      type: 'smoothstep',
    };

    const nextNodes = [...nodes, newNode];
    const nextEdges = [...edges, newEdge];
    const layouted = getLayoutedElements(nextNodes, nextEdges);
    
    setNodes(layouted.nodes);
    setEdges(layouted.edges);
    updateCurrentMap(layouted.nodes, layouted.edges);
  };

  const deleteSelectedNode = () => {
    if (!selectedNode) return;
    // Don't delete root
    if (nodes.length <= 1 || (selectedNode.data.depth === 0)) return;
    
    // Find all descendants to delete
    const toDeleteIds = new Set([selectedNode.id]);
    let added = true;
    while(added) {
      added = false;
      edges.forEach(e => {
        if (toDeleteIds.has(e.source) && !toDeleteIds.has(e.target)) {
          toDeleteIds.add(e.target);
          added = true;
        }
      });
    }

    const nextNodes = nodes.filter(n => !toDeleteIds.has(n.id));
    const nextEdges = edges.filter(e => !toDeleteIds.has(e.source) && !toDeleteIds.has(e.target));
    
    const layouted = getLayoutedElements(nextNodes, nextEdges);
    setNodes(layouted.nodes);
    setEdges(layouted.edges);
    setSelectedNode(null);
    setExplanation(null);
    updateCurrentMap(layouted.nodes, layouted.edges);
  };

  const renameSelectedNode = () => {
    if (!selectedNode) return;
    const newName = prompt('Enter new topic name:', selectedNode.data.label as string);
    if (!newName || newName.trim() === '') return;
    
    const nextNodes = nodes.map(n => {
      if (n.id === selectedNode.id) {
        return { ...n, data: { ...n.data, label: newName.trim() } };
      }
      return n;
    });
    
    setNodes(nextNodes);
    updateCurrentMap(nextNodes, edges);
  };

  const onInit = () => {
    // Empty state
  };

  const exportMap = useCallback(() => {
    if (flowWrapper.current === null) return;
    toPng(flowWrapper.current, { backgroundColor: '#0a0b1a' })
      .then((dataUrl) => {
        const link = document.createElement('a');
        link.download = `mindmap-${topic.replace(/\\s+/g, '-').toLowerCase() || 'export'}.png`;
        link.href = dataUrl;
        link.click();
      });
  }, [topic]);

  const convertToRoadmap = async () => {
    if (nodes.length === 0) return;
    const tree = convertFlowToMindMap(nodes, edges);
    try {
      const rm = await api.convertMindMapToRoadmap(tree, 'intermediate', '1 hour/day');
      alert(`Roadmap created: ${rm.goal}. Check your roadmaps dashboard!`);
    } catch (err) {
      console.error(err);
      alert('Failed to convert to roadmap');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>
      {/* Header controls outside standard flow */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 4 }}>Knowledge Graph & Mind Maps</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Interactive AI node network. Generate, edit, and explore your knowledge visually.
        </p>
      </div>

      <div className="glass-card card-3d" style={{ padding: 16, marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <input value={topic} onChange={e => setTopic(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && generateMap()}
            placeholder="Topic (e.g. Neural Networks, Ancient Rome...)"
            className="glass-input" style={{ width: '100%' }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <select value={depth} onChange={(e) => setDepth(Number(e.target.value))} className="glass-input" style={{ width: 120, padding: '12px' }}>
            <option value={1}>Depth: 1</option>
            <option value={2}>Depth: 2</option>
            <option value={3}>Depth: 3</option>
            <option value={4}>Depth: 4</option>
          </select>

          <div style={{ display: 'flex', borderRadius: 8, border: '1px solid var(--border-default)', overflow: 'hidden' }}>
            <button onClick={() => setUseDocuments(false)}
              style={{ padding: '12px 14px', cursor: 'pointer', background: !useDocuments ? 'rgba(59,130,246,0.15)' : 'transparent', color: !useDocuments ? 'var(--accent-blue)' : 'var(--text-muted)', border: 'none', borderRight: '1px solid var(--border-default)', fontSize: '0.85rem' }}>
              <HiOutlineGlobeAlt /> Fast Web
            </button>
            <button onClick={() => setUseDocuments(true)}
              style={{ padding: '12px 14px', cursor: 'pointer', background: useDocuments ? 'rgba(139,92,246,0.15)' : 'transparent', color: useDocuments ? 'var(--accent-purple)' : 'var(--text-muted)', border: 'none', fontSize: '0.85rem' }}>
              <HiOutlineDocumentText /> Private Docs
            </button>
          </div>
          
          <button onClick={generateMap} disabled={loading || !topic.trim()} className="btn-gradient" style={{ padding: '12px 20px', whiteSpace: 'nowrap' }}>
            {loading ? 'Thinking...' : '✨ Generate'}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0 }}>
        {/* Main React Flow Wrapper */}
        <div className="glass-card" style={{ flex: 1, position: 'relative', overflow: 'hidden', borderRadius: 16 }} ref={flowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={(_, node) => setSelectedNode(node)}
            onPaneClick={() => setSelectedNode(null)}
            onInit={onInit}
            fitView
            connectionLineType={ConnectionLineType.SmoothStep}
            minZoom={0.1}
            maxZoom={2}
          >
            <Background color="#ffffff" gap={20} size={1} style={{ opacity: 0.05 }} />
            <Controls style={{ display: 'flex', flexDirection: 'row', bottom: 10, left: 10, position: 'absolute' }} />
            
            {/* Top right panel tools */}
            <Panel position="top-right" style={{ display: 'flex', gap: 8, background: 'rgba(10,11,26,0.8)', padding: 8, borderRadius: 12, backdropFilter: 'blur(10px)', border: '1px solid var(--border-subtle)' }}>
              <button onClick={() => setShowHistory(true)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center', gap: 6 }} title="History">
                <HiOutlineFolderArrowDown size={18} /> <span style={{fontSize: '0.8rem'}}>Saved</span>
              </button>
              <button onClick={exportMap} disabled={nodes.length === 0} style={{ background: 'none', border: 'none', color: nodes.length ? 'var(--text-secondary)' : '#333', cursor: nodes.length ? 'pointer' : 'not-allowed', padding: 6, display: 'flex', alignItems: 'center', gap: 6 }} title="Export Image">
                <HiOutlineArrowsPointingOut size={18} /> <span style={{fontSize: '0.8rem'}}>Export</span>
              </button>
              <button onClick={convertToRoadmap} disabled={nodes.length === 0} style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid var(--accent-blue)', color: 'var(--accent-blue)', borderRadius: 6, cursor: nodes.length ? 'pointer' : 'not-allowed', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6 }} title="Convert to Roadmap">
                <HiOutlineMap size={18} /> <span style={{fontSize: '0.8rem'}}>Make Roadmap</span>
              </button>
            </Panel>

            {/* Editing context menu if node selected */}
            <AnimatePresence>
              {selectedNode && (
                <Panel position="bottom-center" style={{ bottom: 20 }}>
                  <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
                    style={{ background: 'rgba(16,18,40,0.95)', border: '1px solid var(--border-default)', padding: 12, borderRadius: 16, display: 'flex', gap: 12, backdropFilter: 'blur(10px)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', alignItems: 'center' }}>
                    <div style={{ padding: '0 12px', borderRight: '1px solid var(--border-subtle)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, fontSize: '0.9rem' }}>
                      {selectedNode.data.label as string}
                    </div>
                    
                    <button onClick={() => explainNode(selectedNode)} style={{ background: 'rgba(139,92,246,0.15)', color: 'var(--accent-purple)', border: 'none', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', fontWeight: 500 }}>
                      <HiOutlineLightBulb size={16} /> Explain AI
                    </button>
                    
                    <div style={{ width: 1, height: 20, background: 'var(--border-subtle)' }} />
                    
                    <button onClick={addChild} style={{ background: 'none', color: 'var(--text-primary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem' }}>
                      <HiOutlinePlus size={16} /> Child
                    </button>
                    <button onClick={renameSelectedNode} style={{ background: 'none', color: 'var(--text-primary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem' }}>
                      <HiOutlinePencilSquare size={16} /> Rename
                    </button>
                    <button onClick={deleteSelectedNode} disabled={selectedNode.data.depth === 0} style={{ background: 'none', color: selectedNode.data.depth === 0 ? '#444' : '#ef4444', border: 'none', cursor: selectedNode.data.depth === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem' }}>
                      <HiOutlineTrash size={16} /> Remove
                    </button>
                  </motion.div>
                </Panel>
              )}
            </AnimatePresence>
            
            {/* Status Panel */}
            <Panel position="bottom-left" style={{ bottom: 20, left: 20, pointerEvents: 'none' }}>
              <div style={{ background: 'rgba(0,0,0,0.5)', padding: '6px 12px', borderRadius: 8, fontSize: '0.75rem', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                {nodes.length} Nodes • {edges.length} Connections
              </div>
            </Panel>
          </ReactFlow>
          
          {nodes.length === 0 && !loading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <div style={{ textAlign: 'center', opacity: 0.5 }}>
                 <HiOutlineLightBulb size={64} style={{ margin: '0 auto 16px', color: 'var(--text-muted)' }} />
                 <h2 style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>Empty Canvas</h2>
                 <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', maxWidth: 300, margin: '8px auto' }}>Enter a topic above and let AI generate a fully interactive knowledge graph.</p>
              </div>
            </div>
          )}
        </div>

        {/* Side panels (Explanation / History) */}
        <AnimatePresence>
          {(explaining || explanation || showHistory) && (
            <motion.div
              initial={{ width: 0, opacity: 0 }} animate={{ width: 320, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
              className="glass-card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            >
              {showHistory ? (
                <div style={{ padding: 20, height: '100%', overflowY: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><HiOutlineFolderArrowDown /> Saved Maps</h3>
                    <button onClick={() => setShowHistory(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><HiOutlineXMark size={20}/></button>
                  </div>
                  {savedMaps.length === 0 ? (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 40 }}>No saved maps yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {savedMaps.map(m => (
                        <div key={m.id} onClick={() => loadMap(m)} style={{ padding: 12, background: currentMapId === m.id ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${currentMapId === m.id ? 'var(--accent-blue)' : 'var(--border-subtle)'}`, borderRadius: 10, cursor: 'pointer', transition: 'all 0.2s' }}>
                          <div style={{ fontSize: '0.9rem', fontWeight: 500, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.title}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(m.updated_at).toLocaleDateString()}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: 20, height: '100%', overflowY: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-purple)' }}><HiOutlineLightBulb /> Node Intelligence</h3>
                    <button onClick={() => { setExplanation(null); setExplaining(false); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><HiOutlineXMark size={20}/></button>
                  </div>
                  
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)' }}>
                    {selectedNode?.data.label as string}
                  </div>

                  {explaining ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div className="shimmer-bg" style={{ height: 16, borderRadius: 4, width: '100%' }} />
                      <div className="shimmer-bg" style={{ height: 16, borderRadius: 4, width: '90%' }} />
                      <div className="shimmer-bg" style={{ height: 16, borderRadius: 4, width: '80%' }} />
                      <div className="shimmer-bg" style={{ height: 16, borderRadius: 4, width: '95%' }} />
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 20 }}>AI is thinking...</p>
                    </div>
                  ) : (
                    <div className="markdown-body" dangerouslySetInnerHTML={{ __html: (explanation || '').replace(/\n/g, '<br/>') }} style={{ fontSize: '0.9rem', lineHeight: 1.6 }} />
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function MindMapPage() {
  return (
    <ReactFlowProvider>
      <FlowApp />
    </ReactFlowProvider>
  );
}
