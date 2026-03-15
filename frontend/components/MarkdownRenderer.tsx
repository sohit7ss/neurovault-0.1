import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import 'katex/dist/katex.min.css'; // Ensure the katex css is loaded for math blocks

interface MarkdownRendererProps {
  content: string;
  className?: string; // Optional wrapper class
}

export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  return (
    <div className={`markdown-wrapper ${className}`} style={{
      fontSize: '0.95rem',
      lineHeight: 1.6,
      color: 'var(--text-secondary, #cbd5e1)'
    }}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex]}
        components={{
          h1: ({node, ...props}) => <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '1.2em', marginBottom: '0.6em', color: 'var(--text-primary, #fff)' }} {...props} />,
          h2: ({node, ...props}) => <h2 style={{ fontSize: '1.3rem', fontWeight: 600, marginTop: '1.2em', marginBottom: '0.6em', color: 'var(--text-primary, #fff)' }} {...props} />,
          h3: ({node, ...props}) => <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '1em', marginBottom: '0.5em', color: 'var(--text-primary, #fff)' }} {...props} />,
          p: ({node, ...props}) => <p style={{ marginBottom: '1em' }} {...props} />,
          ul: ({node, ...props}) => <ul style={{ listStyleType: 'disc', paddingLeft: '1.5em', marginBottom: '1em' }} {...props} />,
          ol: ({node, ...props}) => <ol style={{ listStyleType: 'decimal', paddingLeft: '1.5em', marginBottom: '1em' }} {...props} />,
          li: ({node, ...props}) => <li style={{ marginBottom: '0.2em' }} {...props} />,
          strong: ({node, ...props}) => <strong style={{ fontWeight: 600, color: 'var(--text-primary, #fff)' }} {...props} />,
          em: ({node, ...props}) => <em style={{ fontStyle: 'italic', color: 'var(--accent-purple, #a78bfa)' }} {...props} />,
          blockquote: ({node, ...props}) => (
            <blockquote style={{ 
              borderLeft: '4px solid var(--accent-blue, #3b82f6)', 
              paddingLeft: '1em', 
              color: 'var(--text-muted, #94a3b8)',
              fontStyle: 'italic',
              background: 'rgba(59, 130, 246, 0.05)',
              padding: '0.5em 1em',
              borderRadius: '0 8px 8px 0',
              marginBottom: '1em'
            }} {...props} />
          ),
          code({node, inline, className, children, ...props}: any) {
            const match = /language-(\w+)/.exec(className || '');
            return !inline ? (
              <pre style={{
                background: 'rgba(0, 0, 0, 0.4)',
                padding: '1em',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                overflowX: 'auto',
                marginBottom: '1em',
                fontFamily: 'monospace',
                fontSize: '0.85rem'
              }}>
                <code className={className} {...props}>
                  {children}
                </code>
              </pre>
            ) : (
              <code style={{
                background: 'rgba(255, 255, 255, 0.1)',
                padding: '0.2em 0.4em',
                borderRadius: '4px',
                fontSize: '0.85rem',
                fontFamily: 'monospace',
                color: '#e2e8f0'
              }} className={className} {...props}>
                {children}
              </code>
            );
          },
          table: ({node, ...props}) => (
            <div style={{ overflowX: 'auto', marginBottom: '1em' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }} {...props} />
            </div>
          ),
          th: ({node, ...props}) => (
            <th style={{ borderBottom: '1px solid var(--border-default, #334155)', padding: '0.75em', background: 'rgba(255, 255, 255, 0.02)', fontWeight: 600, color: 'var(--text-primary, #fff)' }} {...props} />
          ),
          td: ({node, ...props}) => (
            <td style={{ borderBottom: '1px solid var(--border-subtle, #1e293b)', padding: '0.75em' }} {...props} />
          ),
          a: ({node, ...props}) => (
            <a style={{ color: 'var(--accent-blue, #60a5fa)', textDecoration: 'none', borderBottom: '1px solid transparent', transition: 'border-color 0.2s' }} 
               onMouseEnter={(e) => e.currentTarget.style.borderBottomColor = 'currentColor'} 
               onMouseLeave={(e) => e.currentTarget.style.borderBottomColor = 'transparent'} 
               target="_blank" rel="noopener noreferrer" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
