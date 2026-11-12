import React from 'react';

export interface CategoryBadgeInfo {
  label: string;
  className: string;
  style: React.CSSProperties;
}

export function getCategoryBadgeInfo(category?: string | null): CategoryBadgeInfo {
  if (!category || !category.trim()) {
    return {
      label: 'Solar Rooftop',
      className: 'border-blue-300 bg-blue-100 text-blue-900',
      style: { backgroundColor: '#dbeafe', borderColor: '#93c5fd', color: '#1e40af' }
    };
  }

  const raw = category.trim();
  const upper = raw.toUpperCase();

  // 1. Street Light (Amber / Gold)
  if (upper === 'SOLAR_STREETLIGHT' || upper.includes('STREET LIGHT') || upper.includes('STREETLIGHT')) {
    return {
      label: 'Solar Street Light',
      className: 'border-amber-300 bg-amber-100 text-amber-900',
      style: { backgroundColor: '#fef3c7', borderColor: '#fcd34d', color: '#78350f' }
    };
  }

  // 2. Water Pump (Emerald Green)
  if (upper === 'SOLAR_WATERPUMP' || upper.includes('WATER PUMP') || upper.includes('WATERPUMP')) {
    return {
      label: 'Solar Water Pump',
      className: 'border-emerald-300 bg-emerald-100 text-emerald-900',
      style: { backgroundColor: '#d1fae5', borderColor: '#6ee7b7', color: '#064e3b' }
    };
  }

  // 3. CCTV Camera (Indigo)
  if (upper === 'SOLAR_CCTV' || upper.includes('CCTV')) {
    return {
      label: 'Solar CCTV Camera',
      className: 'border-indigo-300 bg-indigo-100 text-indigo-900',
      style: { backgroundColor: '#e0e7ff', borderColor: '#a5b4fc', color: '#312e81' }
    };
  }

  // 4. Rooftop (Blue)
  if (upper === 'SOLAR_ROOFTOP' || upper.includes('ROOFTOP')) {
    return {
      label: 'Solar Rooftop',
      className: 'border-blue-300 bg-blue-100 text-blue-900',
      style: { backgroundColor: '#dbeafe', borderColor: '#93c5fd', color: '#1e40af' }
    };
  }

  // 5. I & C Service (Cyan)
  if (upper === 'SOLAR_IC' || upper.includes('I & C') || upper.includes('INSTALLATION') || upper.includes('COMMISSIONING')) {
    return {
      label: 'Solar I & C Service',
      className: 'border-cyan-300 bg-cyan-100 text-cyan-900',
      style: { backgroundColor: '#cffafe', borderColor: '#67e8f9', color: '#164e63' }
    };
  }

  // 6. Fencing (Rose)
  if (upper === 'SOLAR_FENCING' || upper.includes('FENCING')) {
    return {
      label: 'Solar Fencing',
      className: 'border-rose-300 bg-rose-100 text-rose-900',
      style: { backgroundColor: '#ffe4e6', borderColor: '#fda4af', color: '#881337' }
    };
  }

  // 7. Water Heater / AMC (Teal)
  if (upper === 'SOLAR_AMC' || upper.includes('HEATER') || upper.includes('AMC')) {
    return {
      label: 'Solar Water Heater / AMC',
      className: 'border-teal-300 bg-teal-100 text-teal-900',
      style: { backgroundColor: '#ccfbf1', borderColor: '#5eead4', color: '#134e4a' }
    };
  }

  // 8. Custom / Other category (Purple)
  return {
    label: raw,
    className: 'border-purple-300 bg-purple-100 text-purple-900',
    style: { backgroundColor: '#f3e8ff', borderColor: '#d8b4fe', color: '#581c87' }
  };
}

export interface CategoryBadgeProps {
  category?: string | null;
  className?: string;
  style?: React.CSSProperties;
}

export function CategoryBadge({ category, className = '', style }: CategoryBadgeProps) {
  const info = getCategoryBadgeInfo(category);
  return (
    <span
      className={`inline-flex items-center justify-center px-4 py-2 rounded-lg text-xs font-semibold leading-normal text-center border shadow-xs ${info.className} ${className}`}
      style={{
        ...info.style,
        ...style
      }}
    >
      {info.label}
    </span>
  );
}
