import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Send, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { API_BASE } from './config';

const CHUNK_SIZE = 8;
const BulkSendContext = createContext(null);

export function useBulkSend() {
  const ctx = useContext(BulkSendContext);
  if (!ctx) throw new Error('useBulkSend must be used within BulkSendProvider');
  return ctx;
}

export function BulkSendProvider({ children }) {
  const [job, setJob] = useState(null);
  const runningRef = useRef(false);
  const cancelledRef = useRef(false);

  const startBulkSend = useCallback(({ templateId, leadIds, templateName }) => {
    if (runningRef.current) {
      return { ok: false, error: 'A send is already running' };
    }
    const ids = Array.isArray(leadIds) ? leadIds.filter(Boolean) : [];
    if (!templateId || ids.length === 0) {
      return { ok: false, error: 'Select a template and at least one lead' };
    }

    runningRef.current = true;
    cancelledRef.current = false;
    setJob({
      status: 'running',
      templateName: templateName || 'template',
      total: ids.length,
      sent: 0,
      failed: 0,
      done: 0,
      errors: [],
      error: '',
    });

    (async () => {
      for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        if (cancelledRef.current) break;
        const chunk = ids.slice(i, i + CHUNK_SIZE);
        try {
          const res = await fetch(`${API_BASE}/leads/bulk-send-message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ templateId, leadIds: chunk }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            const message = data.error || 'Bulk send failed';
            setJob((prev) => ({
              ...prev,
              failed: prev.failed + chunk.length,
              done: Math.min(prev.total, prev.done + chunk.length),
              error: i === 0 ? message : prev.error,
              errors: [...prev.errors, { error: message }].slice(-6),
            }));
            if (res.status === 400) break;
            continue;
          }
          const failedRows = (data.results || []).filter((r) => !r.ok);
          setJob((prev) => ({
            ...prev,
            sent: prev.sent + (data.sent || 0),
            failed: prev.failed + (data.failed || 0),
            done: Math.min(prev.total, prev.done + chunk.length),
            errors: [
              ...prev.errors,
              ...failedRows.map((r) => ({
                phone: r.phone,
                error: r.error,
              })),
            ].slice(-6),
          }));
        } catch (err) {
          setJob((prev) => ({
            ...prev,
            failed: prev.failed + chunk.length,
            done: Math.min(prev.total, prev.done + chunk.length),
            errors: [...prev.errors, { error: err.message }].slice(-6),
          }));
        }
      }
      runningRef.current = false;
      setJob((prev) =>
        prev
          ? { ...prev, status: cancelledRef.current ? 'cancelled' : 'done' }
          : prev,
      );
    })();

    return { ok: true };
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  const dismiss = useCallback(() => {
    if (runningRef.current) return;
    setJob(null);
  }, []);

  return (
    <BulkSendContext.Provider value={{ job, startBulkSend, cancel, dismiss }}>
      {children}
      <BulkSendProgressCard job={job} onCancel={cancel} onDismiss={dismiss} />
    </BulkSendContext.Provider>
  );
}

function BulkSendProgressCard({ job, onCancel, onDismiss }) {
  if (!job) return null;
  const pct = job.total ? Math.round((job.done / job.total) * 100) : 0;
  const running = job.status === 'running';
  const done = job.status === 'done' || job.status === 'cancelled';

  return (
    <div
      className="fixed bottom-4 right-4 z-[130] w-[min(100vw-2rem,22rem)] rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
      dir="ltr"
      role="status"
      aria-live="polite"
    >
      <div className="px-4 py-3 flex items-start justify-between gap-3 bg-indigo-600 text-white">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Send className="w-4 h-4 shrink-0" />
            {running ? 'Sending in background' : job.status === 'cancelled' ? 'Send stopped' : 'Send finished'}
          </div>
          <p className="text-xs text-indigo-100 mt-0.5 truncate">{job.templateName}</p>
        </div>
        {done ? (
          <button type="button" onClick={onDismiss} className="p-1 rounded-lg hover:bg-white/15" aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        ) : (
          <button type="button" onClick={onCancel} className="text-xs font-semibold px-2 py-1 rounded-lg hover:bg-white/15">
            Stop
          </button>
        )}
      </div>
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-lg font-extrabold text-slate-800 tabular-nums">
            {job.done} / {job.total}
          </p>
          <p className="text-xs text-slate-500">{pct}%</p>
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${job.failed && done && job.sent === 0 ? 'bg-red-500' : 'bg-indigo-600'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1 text-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Sent {job.sent}
          </span>
          <span className="inline-flex items-center gap-1 text-red-600">
            <AlertCircle className="w-3.5 h-3.5" />
            Failed {job.failed}
          </span>
        </div>
        {job.error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-2 py-1.5">{job.error}</p>
        )}
        {job.errors.length > 0 && !job.error && (
          <p className="text-[11px] text-slate-500 truncate">
            Last error: {job.errors[job.errors.length - 1].phone ? `${job.errors[job.errors.length - 1].phone}: ` : ''}
            {job.errors[job.errors.length - 1].error}
          </p>
        )}
      </div>
    </div>
  );
}
