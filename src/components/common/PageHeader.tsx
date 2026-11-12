import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: { label: string; to?: string }[];
  action?: React.ReactNode;
}

export function PageHeader({ title, description, breadcrumbs, action }: PageHeaderProps) {
  return (
    <div 
      className="flex justify-between items-center mb-6 page-header"
      style={{
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        gap: '1rem',
        paddingRight: '10px' // Guaranteed 10px gap from right display edge
      }}
    >
      <div style={{ minWidth: 0, flex: '1 1 auto' }}>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <div className="flex gap-2 text-sm text-muted mb-2">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={idx}>
                {crumb.to ? (
                  <a href={`#${crumb.to}`} className="hover:text-primary-color">{crumb.label}</a>
                ) : (
                  <span className="text-secondary">{crumb.label}</span>
                )}
                {idx < breadcrumbs.length - 1 && <span>/</span>}
              </React.Fragment>
            ))}
          </div>
        )}
        <h1 style={{ margin: 0, overflowWrap: 'break-word', wordBreak: 'normal' }}>{title}</h1>
        {description && <p className="text-secondary mt-1">{description}</p>}
      </div>
      {action && (
        <div 
          className="page-header-action"
          style={{ 
            flexShrink: 0, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'flex-end',
            marginRight: '10px' // Exactly 10px gap on right
          }}
        >
          {action}
        </div>
      )}
    </div>
  );
}
