import React from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="card text-center p-8 flex flex-col items-center">
      {icon && <div className="text-muted mb-4" style={{ fontSize: '3rem' }}>{icon}</div>}
      <h3 className="mb-2">{title}</h3>
      <p className="text-secondary mb-6 max-w-md">{description}</p>
      {action}
    </div>
  );
}
