import { useState, useEffect, useCallback } from 'react';
import {
  Plug,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ChevronRight,
  X,
} from 'lucide-react';
import { API_BASE } from '../config';
import { authCountryToShippingDestination } from '../authCountryUtils';

function destinationLabel(dest) {
  if (dest === 'india') return 'India';
  if (dest === 'thailand') return 'Thailand';
  return dest || '—';
}

function destinationBadgeClass(dest) {
  if (dest === 'india') return 'bg-orange-100 text-orange-800 ring-orange-200/80';
  if (dest === 'thailand') return 'bg-emerald-100 text-emerald-800 ring-emerald-200/80';
  return 'bg-slate-100 text-slate-700 ring-slate-200/80';
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('he-IL', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function scopeLabel(authUser) {
  if (!authUser) return '';
  if (authUser.isAdmin || !authUser.country) return 'All countries';
  const dest = authCountryToShippingDestination(authUser.country);
  if (dest === 'india') return 'India only';
  if (dest === 'thailand') return 'Thailand only';
  return authUser.country;
}

function DetailModal({ entry, onClose }) {
  if (!entry) return null;
  const ok = entry.outcome?.success;
  return (
    <div className="modal-overlay z-50" onClick={onClose}>
      <div
        className="modal-content max-w-2xl animate-slide-up max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800">Integration request</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="p-6 space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-slate-500 text-xs uppercase tracking-wide">Received</div>
              <div className="font-medium text-slate-800">{formatDate(entry.receivedAt)}</div>
            </div>
            <div>
              <div className="text-slate-500 text-xs uppercase tracking-wide">Destination</div>
              <span className={`inline-flex mt-1 px-2 py-0.5 rounded-lg text-xs font-medium ring-1 ${destinationBadgeClass(entry.destination)}`}>
                {destinationLabel(entry.destination)}
              </span>
            </div>
            <div>
              <div className="text-slate-500 text-xs uppercase tracking-wide">Status</div>
              <div className={`font-medium ${ok ? 'text-emerald-700' : 'text-red-700'}`}>
                {ok ? 'Success' : 'Error'}
              </div>
            </div>
            {entry.outcome?.taskId != null && (
              <div>
                <div className="text-slate-500 text-xs uppercase tracking-wide">Task ID</div>
                <div className="font-mono text-slate-800">{entry.outcome.taskId}</div>
              </div>
            )}
          </div>

          {entry.outcome?.error && (
            <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-red-800">
              {entry.outcome.error}
              {entry.outcome.detail && (
                <div className="text-red-600/90 mt-1 text-xs">{entry.outcome.detail}</div>
              )}
            </div>
          )}

          <div>
            <div className="text-slate-500 text-xs uppercase tracking-wide mb-2">Request</div>
            <pre className="text-xs bg-slate-50 border border-slate-100 rounded-xl p-4 overflow-x-auto text-slate-800">
              {JSON.stringify(entry.request || {}, null, 2)}
            </pre>
          </div>

          <div>
            <div className="text-slate-500 text-xs uppercase tracking-wide mb-2">Outcome</div>
            <pre className="text-xs bg-slate-50 border border-slate-100 rounded-xl p-4 overflow-x-auto text-slate-800">
              {JSON.stringify(entry.outcome || {}, null, 2)}
            </pre>
          </div>

          {entry.sourceIp && (
            <div className="text-xs text-slate-400">Source IP: {entry.sourceIp}</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function IntegrationsPanel({ authUser }) {
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/integrations/lionwheel/logs?limit=100`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load logs');
      setEntries(data.entries || []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const apiUrl = `${window.location.origin}/api/integrations/lionwheel/create`;

  return (
    <div className="space-y-6">
      {authUser?.isAdmin && (
        <div className="card border-l-4 border-indigo-500 px-4 py-2">
          <p className="text-[11px] leading-snug text-slate-600">
            <span className="font-semibold text-slate-700">External API</span>
            {' · '}
            <code className="bg-slate-50 px-1 rounded text-slate-800">POST {apiUrl}</code>
            {' · Bearer '}
            <code className="bg-slate-100 px-1 rounded">LIONWHEEL_INTEGRATION_API_KEY</code>
            {' · Required: '}
            <code>destination</code>, <code>orderId</code>, <code>city</code>, <code>name</code>, <code>phone</code>, <code>number</code>
            {' · Optional: '}
            <code>type</code>, <code>street</code>, <code>boxes</code>, <code>emptyBoxes</code>
          </p>
        </div>
      )}

      <div className="stat-card border-l-4 border-indigo-500">
        <div className="text-3xl font-extrabold text-slate-800">{total}</div>
        <div className="text-sm text-slate-500 mt-1">Integration requests logged</div>
        <div className="text-xs text-slate-400 mt-1">Showing: {scopeLabel(authUser)}</div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="section-title">
            <Plug className="w-5 h-5 text-indigo-500" />
            LionWheel integration log ({entries.length})
          </h2>
          <button
            type="button"
            onClick={fetchLogs}
            disabled={loading}
            className="btn-secondary"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 flex items-center gap-2 text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm">
            <XCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {loading && entries.length === 0 ? (
          <div className="px-6 py-12 text-center text-slate-400 text-sm">Loading...</div>
        ) : entries.length === 0 ? (
          <div className="px-6 py-12 text-center text-slate-400 text-sm">
            No integration requests yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Destination</th>
                  <th className="px-4 py-3 font-medium">Order ID</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">City</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Task ID</th>
                  <th className="px-4 py-3 w-8" />
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const ok = entry.outcome?.success;
                  return (
                    <tr
                      key={entry.id}
                      className="border-b border-slate-50 hover:bg-slate-50/80 cursor-pointer"
                      onClick={() => setSelected(entry)}
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                        {formatDate(entry.receivedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-medium ring-1 ${destinationBadgeClass(entry.destination)}`}>
                          {destinationLabel(entry.destination)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700 max-w-[8rem] truncate">
                        {entry.request?.orderId || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{entry.request?.type || '—'}</td>
                      <td className="px-4 py-3 text-slate-700 max-w-[8rem] truncate">
                        {entry.request?.name || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-[6rem] truncate">
                        {entry.request?.city || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {ok ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            OK
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-red-700 text-xs font-medium max-w-[10rem] truncate"
                            title={entry.outcome?.error}
                          >
                            <XCircle className="w-3.5 h-3.5 shrink-0" />
                            {entry.outcome?.error || 'Error'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">
                        {entry.outcome?.taskId ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        <ChevronRight className="w-4 h-4" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && <DetailModal entry={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
