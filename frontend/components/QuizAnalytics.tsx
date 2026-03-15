import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import api from '@/lib/api';
import { HiOutlineArrowTrendingUp, HiOutlineExclamationTriangle } from 'react-icons/hi2';

export default function QuizAnalytics() {
  const [history, setHistory] = useState<any[]>([]);
  const [weakTopics, setWeakTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [histRes, weakRes] = await Promise.all([
          api.getQuizHistory(),
          api.getWeakTopics()
        ]);
        
        const formattedHistory = (histRes.attempts || []).reverse().map((a: any, i: number) => ({
          name: `Q${i + 1}`,
          score: Math.round((a.score / a.total_questions) * 100) || 0,
          topic: a.topic,
          date: new Date(a.created_at).toLocaleDateString()
        }));
        
        setHistory(formattedHistory);
        setWeakTopics(weakRes.weak_topics || []);
      } catch (e) {
        console.error("Failed to fetch analytics", e);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  if (loading) {
    return null;
  }

  if (history.length === 0) {
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Progress Chart */}
      <div className="glass-card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <HiOutlineArrowTrendingUp size={24} style={{ color: 'var(--accent-blue)' }} />
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Your Progress</h2>
        </div>
        
        <div style={{ height: 250, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}%`} />
              <Tooltip 
                contentStyle={{ background: 'rgba(15,23,42,0.9)', border: '1px solid var(--border-subtle)', borderRadius: 8, backdropFilter: 'blur(10px)' }}
                itemStyle={{ color: '#fff' }}
                labelStyle={{ color: 'var(--text-muted)', marginBottom: 4 }}
                formatter={(value: number) => [`${value}%`, 'Score']}
              />
              <Line type="monotone" dataKey="score" stroke="var(--accent-blue)" strokeWidth={3} dot={{ fill: 'var(--accent-blue)', r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Weak Topics */}
      {weakTopics.length > 0 && (
        <div className="glass-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <HiOutlineExclamationTriangle size={24} style={{ color: '#f59e0b' }} />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Needs Attention</h2>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
            Topics you consistently score below 60% on:
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {weakTopics.map((topic, i) => (
              <div key={i} style={{ 
                background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', 
                padding: '12px 16px', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <h4 style={{ fontWeight: 600, fontSize: '0.95rem', color: '#fcd34d' }}>{topic.topic}</h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Attempted {topic.attempts} times</span>
                </div>
                <div style={{ 
                  background: 'rgba(239,68,68,0.2)', color: '#fca5a5', 
                  padding: '4px 10px', borderRadius: 20, fontSize: '0.85rem', fontWeight: 700 
                }}>
                  {topic.average}% avg
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
