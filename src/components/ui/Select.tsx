import React from 'react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: { label: string; value: string | number }[];
  error?: string;
  hint?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, error, hint, className = '', id, required, ...props }, ref) => {
    const generatedId = id || `select-${label.replace(/\s+/g, '-').toLowerCase()}`;
    
    return (
      <div className={`form-group ${className}`} style={{ minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' }}>
        <label htmlFor={generatedId}>
          {label} {required && <span className="text-danger">*</span>}
        </label>
        <select 
          id={generatedId} 
          ref={ref} 
          required={required}
          className={error ? 'input-error' : ''} 
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <div className="form-error">{error}</div>}
        {hint && !error && <div className="form-hint">{hint}</div>}
      </div>
    );
  }
);
Select.displayName = 'Select';
