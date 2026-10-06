import { Fragment, useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { API_BASE } from '../config';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function statusClass(status) {
  if (status === 'failed') return 'bg-red-100 text-red-800';
  if (status === 'skipped') return 'bg-amber-100 text-amber-800';
  if (status === 'sent') return 'bg-emerald-100 text-emerald-800';
  return 'bg-slate-100 text-slate-700';
}

export default function MetaCapiEventsPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/capi/events`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load events');
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      setError(err.message || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="card p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-800">Meta Purchase events</h3>
          <p className="text-xs text-slate-500">Failed, skipped, and still waiting. Hashed fields only.</p>
        </div>
        <button
          type="button"
          onClick={load}
          className="action-btn hover:bg-slate-100 text-slate-600"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && items.length === 0 && (
        <p className="text-sm text-slate-500">No failed or pending events.</p>
      )}
      {items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                <th className="py-2 pr-3 font-medium">Mission</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">When</th>
                <th className="py-2 pr-3 font-medium">Error</th>
                <th className="py-2 font-medium">Trace</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <Fragment key={item.id}>
                  <tr
                    className="border-b border-slate-100 cursor-pointer hover:bg-slate-50"
                    onClick={() => setOpenId(openId === item.id ? null : item.id)}
                  >
                    <td className="py-2 pr-3 font-mono text-xs">{item.missionId}</td>
                    <td className="py-2 pr-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusClass(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-slate-600">{formatDate(item.at)}</td>
                    <td className="py-2 pr-3 text-slate-700">{item.error || '—'}</td>
                    <td className="py-2 font-mono text-xs text-slate-500">{item.fbtraceId || '—'}</td>
                  </tr>
                  {openId === item.id && item.payload && (
                    <tr>
                      <td colSpan={5} className="pb-3">
                        <pre className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto">
                          {JSON.stringify(item.payload, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
