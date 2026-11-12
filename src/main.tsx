import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const rootElement = document.getElementById('root')!;

// App-wide protection for number inputs:
// 1. Prevent mouse wheel scroll from changing values anywhere in the app
// 2. Prevent negative signs (-), scientific notation (e, E, +), and arrow up/down keys
// 3. Prevent pasting negative values
document.addEventListener('wheel', (e) => {
  const active = document.activeElement;
  if (active && active.tagName === 'INPUT' && (active as HTMLInputElement).type === 'number') {
    (active as HTMLInputElement).blur();
  }
  const target = e.target as HTMLElement | null;
  if (target && target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'number') {
    (target as HTMLInputElement).blur();
  }
}, { passive: true });

document.addEventListener('keydown', (e) => {
  const target = e.target as HTMLInputElement | null;
  if (target && target.tagName === 'INPUT' && target.type === 'number') {
    if (e.key === '-' || e.key === '+' || e.key === 'e' || e.key === 'E' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
    }
  }
});

document.addEventListener('paste', (e) => {
  const target = e.target as HTMLInputElement | null;
  if (target && target.tagName === 'INPUT' && target.type === 'number') {
    const text = e.clipboardData?.getData('text') || '';
    if (text.includes('-') || text.includes('+')) {
      e.preventDefault();
    }
  }
});

if (!window.desktop) {
  ReactDOM.createRoot(rootElement).render(
    <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1>Please run this application through Electron.</h1>
      <p>This is a desktop application and cannot be run in a standard web browser.</p>
    </div>
  );
} else {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
