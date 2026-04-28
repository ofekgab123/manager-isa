import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Trash2, ChevronDown, ChevronRight, Webhook } from 'lucide-react';
import { API_BASE } from '../config';

function outcomeBadgeClasses(status) {
  if (status === 200) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (status === 401 || status === 403) return 'bg-amber-100 text-amber-900 border-amber-200';
  if (status === 404) return 'bg-slate-100 text-slate-700 border-slate-200';
  if (status === 400) return 'bg-orange-100 text-orange-900 border-orange-200';
  if (status === 503) return 'bg-violet-100 text-violet-900 border-violet-200';
  return 'bg-red-50 text-red-800 border-red-200';
}

export default function MakeWebhookInboundPanel() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/debug/make-webhook-inbound-log`);
      if (res.status === 403) {
        setError('Admin access required.');
        setEntries([]);
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setEntries(Array.isArray(data.entries) ? data.entries : []);
    } catch (e) {
      setError(e.message || 'Failed to load');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  const handleClear = async () => {
    if (!window.confirm('Clear all logged webhook requests from memory on this server?')) return;
    try {
      const res = await fetch(`${API_BASE}/debug/make-webhook-inbound-log`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Clear failed');
      await load();
      setExpandedId(null);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <section className="max-w-5xl animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-indigo-100 p-2.5 text-indigo-700 mt-0.5">
            <Webhook className="w-6 h-6" aria-hidden />
          </div>
          <div>
            <h2 className="section-title mb-1">
              Make webhook inspector
            </h2>
            <p className="text-slate-600 text-sm max-w-xl leading-relaxed">
              Incoming POST requests to{' '}
              <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono text-indigo-800">
                /api/webhooks/make-lionwheel-status
              </code>{' '}
              are logged here (secrets redacted). Polls every few seconds while this tab is open.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => { setLoading(true); load(); }}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-red-200 bg-red-50 text-red-800 hover:bg-red-100 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Clear log
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading && entries.length === 0 ? (
        <div className="text-slate-500 text-sm py-12 text-center">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-14 text-center text-slate-500 text-sm">
          No webhook requests recorded yet. Trigger Make → LionWheel status or send a test POST.
        </div>
      ) : (
        <ul className="space-y-3">
          {entries.map((row) => {
            const open = expandedId === row.id;
            const st = row.outcome?.httpStatus ?? '—';
            return (
              <li
                key={row.id}
                className="rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(open ? null : row.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50/80 transition-colors"
                >
                  {open ? <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" /> : <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />}
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold border shrink-0 ${outcomeBadgeClasses(typeof st === 'number' ? st : 500)}`}>
                    HTTP {st}
                  </span>
                  <span className="text-sm font-semibold text-slate-800 truncate">
                    {row.receivedAt || '—'}
                  </span>
                  <span className="text-xs text-slate-500 ml-auto truncate max-w-[40%] hidden sm:inline">
                    {row.outcome?.phase ? `${row.outcome.phase}` : ''}
                    {row.outcome?.missionId ? ` · ${row.outcome.missionId}` : ''}
                  </span>
                </button>
                {open && (
                  <div className="border-t border-slate-100 px-4 pb-4 pt-2 space-y-4 bg-slate-50/50">
                    <div className="grid sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="font-semibold text-slate-600 mb-1">Client</div>
                        <pre className="text-slate-700 whitespace-pre-wrap break-all bg-white rounded-lg border border-slate-100 p-2 font-mono">
                          {JSON.stringify({ ip: row.ip, forwardedFor: row.forwardedFor }, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <div className="font-semibold text-slate-600 mb-1">Request line</div>
                        <pre className="text-slate-700 whitespace-pre-wrap break-all bg-white rounded-lg border border-slate-100 p-2 font-mono">
                          {JSON.stringify({ method: row.method, originalUrl: row.originalUrl, query: row.query }, null, 2)}
                        </pre>
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold text-slate-600 mb-1 text-xs">Headers</div>
                      <pre className="text-[11px] leading-relaxed text-slate-800 whitespace-pre-wrap break-all bg-white rounded-lg border border-slate-100 p-3 font-mono overflow-x-auto max-h-48 overflow-y-auto">
                        {JSON.stringify(row.headers || {}, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <div className="font-semibold text-slate-600 mb-1 text-xs">Body (JSON)</div>
                      <pre className="text-[11px] leading-relaxed text-slate-800 whitespace-pre-wrap break-all bg-white rounded-lg border border-slate-100 p-3 font-mono overflow-x-auto max-h-64 overflow-y-auto">
                        {JSON.stringify(row.body ?? null, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <div className="font-semibold text-slate-600 mb-1 text-xs">Outcome</div>
                      <pre className="text-[11px] leading-relaxed text-slate-800 whitespace-pre-wrap break-all bg-white rounded-lg border border-slate-100 p-3 font-mono overflow-x-auto max-h-48 overflow-y-auto">
                        {JSON.stringify(row.outcome || {}, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
