import React from 'react';

export interface TabItem {
  id: string;
  label: string;
  content: React.ReactNode;
}

interface TabsProps {
  items: TabItem[];
  activeId?: string;
  onChange?: (id: string) => void;
  className?: string;
}

export function Tabs({ items, activeId, onChange, className = '' }: TabsProps) {
  const [internalActive, setInternalActive] = React.useState(items[0]?.id);
  
  const currentActive = activeId !== undefined ? activeId : internalActive;

  const handleTabClick = (id: string) => {
    setInternalActive(id);
    onChange?.(id);
  };

  return (
    <div className={`tabs-container ${className}`}>
      <div className="tabs-header">
        {items.map(item => (
          <button
            key={item.id}
            type="button"
            className={`tab-btn ${currentActive === item.id ? 'active' : ''}`}
            onClick={() => handleTabClick(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="tabs-content">
        {items.find(t => t.id === currentActive)?.content}
      </div>
    </div>
  );
}
