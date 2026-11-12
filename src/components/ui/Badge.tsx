import React from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span 
      className={`badge badge-${variant} ${className}`}
      style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center' }}
    >
      {children}
    </span>
  );
}
