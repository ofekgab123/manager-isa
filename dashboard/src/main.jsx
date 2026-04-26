import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Patch global fetch to inject Authorization header for all /api/ requests
const _originalFetch = window.fetch.bind(window);

function apiUrlString(input) {
  if (typeof input === 'string') return input;
  if (typeof URL !== 'undefined' && input instanceof URL) return input.href;
  if (typeof Request !== 'undefined' && input instanceof Request) return input.url;
  return '';
}

window.fetch = function (input, init = {}) {
  const token = localStorage.getItem('isa_auth_token');
  const href = apiUrlString(input);
  if (!token || !href.includes('/api/')) {
    return _originalFetch(input, init);
  }

  if (typeof Request !== 'undefined' && input instanceof Request) {
    const headers = new Headers(input.headers);
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return _originalFetch(new Request(input, { headers }), init);
  }

  const headers = new Headers(init.headers || {});
  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return _originalFetch(input, { ...init, headers });
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
