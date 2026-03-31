import { useState } from 'react';
import { LogIn, Eye, EyeOff } from 'lucide-react';
import { API_BASE } from '../config';

export default function LoginPage({ onLogin }) {
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username.trim() || !form.password) {
      setError('Please enter username and password');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: form.username.trim(), password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }
      onLogin(data);
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="gradient-header relative flex min-h-screen items-center justify-center overflow-hidden p-6 sm:p-10">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        aria-hidden="true"
        style={{
          backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.09) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-[28rem] w-[28rem] rounded-full bg-indigo-400/25 blur-[100px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-32 -left-20 h-[22rem] w-[22rem] rounded-full bg-violet-500/20 blur-[90px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[min(90vw,36rem)] w-[min(90vw,36rem)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400/[0.07] blur-[110px]"
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-md animate-fade-in">
        <header className="mb-10 text-center sm:mb-12">
          <div className="mx-auto mb-6 flex justify-center">
            <div className="relative">
              <div
                className="absolute inset-0 -m-3 rounded-3xl bg-gradient-to-br from-white/15 to-indigo-400/10 blur-md"
                aria-hidden="true"
              />
              <div className="relative rounded-2xl bg-white/10 p-4 shadow-lg ring-1 ring-white/20 backdrop-blur-sm">
                <img
                  src="/isa-logo.png"
                  alt="ISA Express"
                  className="h-12 w-auto object-contain brightness-0 invert sm:h-14"
                />
              </div>
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-[2rem]">
            Manager ISA
          </h1>
          <p className="mt-3 text-base font-medium text-indigo-200/90">Sign in to continue</p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="glass-card animate-slide-up space-y-6 rounded-3xl px-8 py-10 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.08)] sm:px-10 sm:py-11"
        >
          <div className="space-y-2">
            <label htmlFor="login-username" className="label text-slate-600">
              Username
            </label>
            <input
              id="login-username"
              type="text"
              autoComplete="username"
              value={form.username}
              onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
              placeholder="Enter username"
              className="input-field"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="login-password" className="label text-slate-600">
              Password
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                placeholder="Enter password"
                className="input-field pr-11"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div
              className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 shadow-sm ring-2 ring-red-200/60"
              role="alert"
            >
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary mt-2 w-full py-3">
            <LogIn className="h-4 w-4 shrink-0" />
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
