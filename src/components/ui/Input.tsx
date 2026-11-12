import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', id, required, min, onWheel, onKeyDown, onPaste, ...props }, ref) => {
    const generatedId = id || `input-${label.replace(/\s+/g, '-').toLowerCase()}`;
    const isNumber = props.type === 'number';
    
    return (
      <div className={`form-group ${className}`} style={{ minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' }}>
        <label htmlFor={generatedId}>
          {label} {required && <span className="text-danger">*</span>}
        </label>
        <input 
          id={generatedId} 
          ref={ref} 
          required={required}
          min={isNumber && min === undefined ? '0' : min}
          className={error ? 'input-error' : ''} 
          onWheel={(e) => {
            if (isNumber) {
              (e.target as HTMLElement).blur();
            }
            onWheel?.(e);
          }}
          onKeyDown={(e) => {
            if (isNumber && (e.key === '-' || e.key === '+' || e.key === 'e' || e.key === 'E' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
              e.preventDefault();
            }
            onKeyDown?.(e);
          }}
          onPaste={(e) => {
            if (isNumber) {
              const paste = e.clipboardData?.getData('text') || '';
              if (paste.includes('-') || paste.includes('+')) {
                e.preventDefault();
              }
            }
            onPaste?.(e);
          }}
          {...props} 
        />
        {error && <div className="form-error">{error}</div>}
        {hint && !error && <div className="form-hint">{hint}</div>}
      </div>
    );
  }
);
Input.displayName = 'Input';
