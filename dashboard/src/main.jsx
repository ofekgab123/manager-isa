import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Patch global fetch to inject Authorization header for all /api/ requests
const _originalFetch = window.fetch.bind(window);
window.fetch = function (url, options = {}) {
  const token = localStorage.getItem('isa_auth_token');
  if (token && typeof url === 'string' && url.includes('/api/')) {
    const headers = new Headers(options.headers || {});
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return _originalFetch(url, { ...options, headers });
  }
  return _originalFetch(url, options);
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
