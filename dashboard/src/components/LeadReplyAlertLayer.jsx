import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, X, Phone, ChevronRight } from 'lucide-react';
import { API_BASE } from '../config';

const POLL_MS = 15_000;
const TOAST_TTL_MS = 45_000;
const MAX_TOASTS = 5;

function leadSenderLabel(lead) {
  const name = lead.fullName?.trim();
  if (name) return name;
  return lead.phone || 'Lead';
}

function leadToastBody(lead) {
  if (lead.lastInboundPreview?.trim()) {
    return lead.lastInboundPreview.trim();
  }
  if (lead.alertText) {
    return lead.alertText.replace(/^New message:\s*/i, '');
  }
  return 'New WhatsApp message — tap to open';
}

function pushBrowserNotification(lead) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const sender = leadSenderLabel(lead);
    const n = new Notification(`New message from ${sender}`, {
      body: leadToastBody(lead),
      tag: `lead-reply-${lead.id}-${lead.lastInboundAt}`,
      renotify: true,
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* ignore */
  }
}

export default function LeadReplyAlertLayer({ enabled, onOpenLead, onReplyCountChange }) {
  const [toasts, setToasts] = useState([]);
  const seenInboundRef = useRef(new Map());
  const initializedRef = useRef(false);

  const dismissToast = useCallback((toastId) => {
    setToasts((prev) => prev.filter((t) => t.toastId !== toastId));
  }, []);

  const addToast = useCallback((lead) => {
    const toastId = `${lead.id}-${lead.lastInboundAt}`;
    const sender = leadSenderLabel(lead);
    setToasts((prev) => {
      if (prev.some((t) => t.toastId === toastId)) return prev;
      const next = [
        {
          toastId,
          leadId: lead.id,
          sender,
          phone: lead.phone,
          headline: `New message received from ${sender}`,
          body: leadToastBody(lead),
          createdAt: Date.now(),
        },
        ...prev,
      ];
      return next.slice(0, MAX_TOASTS);
    });
    pushBrowserNotification(lead);
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;

    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/leads`);
        if (!res.ok || cancelled) return;
        const leads = await res.json();
        const replyCount = leads.filter((l) => l.needsReply).length;
        onReplyCountChange?.(replyCount);

        if (!initializedRef.current) {
          for (const lead of leads) {
            if (lead.lastInboundAt) seenInboundRef.current.set(lead.id, lead.lastInboundAt);
          }
          initializedRef.current = true;
          return;
        }

        for (const lead of leads) {
          const inboundAt = lead.lastInboundAt;
          if (!inboundAt) continue;
          const prev = seenInboundRef.current.get(lead.id);
          if (prev !== inboundAt && lead.needsReply) {
            addToast(lead);
          }
          seenInboundRef.current.set(lead.id, inboundAt);
        }
      } catch {
        /* ignore network errors between polls */
      }
    };

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [enabled, addToast, onReplyCountChange]);

  useEffect(() => {
    if (toasts.length === 0) return undefined;
    const timers = toasts.map((t) =>
      setTimeout(() => dismissToast(t.toastId), TOAST_TTL_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismissToast]);

  if (!enabled || toasts.length === 0) return null;

  return (
    <div
      className="fixed top-24 right-4 z-[120] flex flex-col gap-3 w-[min(100vw-2rem,24rem)] pointer-events-none"
      dir="ltr"
      aria-live="polite"
      aria-relevant="additions"
    >
      {toasts.map((toast) => (
        <div
          key={toast.toastId}
          className="pointer-events-auto rounded-2xl border border-amber-200 bg-white shadow-2xl ring-2 ring-amber-300/40 animate-slide-in-right overflow-hidden"
          role="alert"
        >
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="inline-flex items-center gap-2 text-sm font-bold text-white mb-1">
                <MessageSquare className="w-4 h-4 shrink-0" />
                New message
              </span>
              <p className="text-base font-extrabold text-white leading-snug break-words">
                {toast.headline}
              </p>
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.toastId)}
              className="p-1.5 rounded-lg text-white/90 hover:bg-white/20 transition-colors shrink-0"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              dismissToast(toast.toastId);
              onOpenLead?.(toast.leadId);
            }}
            className="w-full text-left px-4 py-3 hover:bg-amber-50/80 transition-colors group"
          >
            <div className="text-xs text-slate-500 inline-flex items-center gap-1">
              <Phone className="w-3 h-3" />
              {toast.phone}
            </div>
            <p className="text-sm text-slate-700 mt-2 line-clamp-4 leading-snug">{toast.body}</p>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 mt-2 group-hover:text-indigo-700">
              Open lead
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </button>
        </div>
      ))}
    </div>
  );
}
