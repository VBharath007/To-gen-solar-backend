import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  action?: React.ReactNode;
  style?: React.CSSProperties;
}

export function Card({ children, className = '', title, action, style }: CardProps) {
  return (
    <div className={`card ${className}`} style={{ minWidth: 0, maxWidth: '100%', boxSizing: 'border-box', overflow: 'visible', ...style }}>
      {(title || action) && (
        <div className="card-header">
          {title && <h3 className="card-title">{title}</h3>}
          {action && <div className="card-action">{action}</div>}
        </div>
      )}
      <div className="card-body" style={{ minWidth: 0, maxWidth: '100%', boxSizing: 'border-box', overflow: 'visible' }}>
        {children}
      </div>
    </div>
  );
}
