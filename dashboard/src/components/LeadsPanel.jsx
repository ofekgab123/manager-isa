import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Phone,
  Plus,
  Search,
  RefreshCw,
  Upload,
  X,
  MessageSquare,
  Send,
  AlertCircle,
  UserPlus,
  List,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import PhoneInput from './PhoneInput';
import MessageTemplatesPanel from './MessageTemplatesPanel';
import { API_BASE } from '../config';
import { useBulkSend } from '../BulkSendContext';

const STATUS_OPTIONS = [
  { value: 'new', label: 'New', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  { value: 'contacted', label: 'Contacted', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'interested', label: 'Interested', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: 'not_interested', label: 'Not interested', className: 'bg-red-100 text-red-800 border-red-200' },
  { value: 'converted', label: 'Converted', className: 'bg-purple-100 text-purple-800 border-purple-200' },
];

function statusMeta(status) {
  return STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[0];
}

function excelKey(k) {
  return String(k || '').toLowerCase().replace(/[^a-z0-9\u0590-\u05ff]+/g, '');
}

function isExcelBlank(value) {
  if (value == null || value === '') return true;
  const text = String(value).trim().replace(/^['"]|['"]$/g, '');
  return /^(null|#null!|undefined|n\/a|na|none|-)$/i.test(text);
}

function excelCell(value) {
  if (isExcelBlank(value)) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number.isInteger(value) ? String(value) : String(value);
  }
  return String(value).trim();
}

function excelFieldMap(row) {
  const map = {};
  for (const [key, value] of Object.entries(row || {})) {
    map[excelKey(key)] = value;
  }
  return map;
}

function getExcelField(row, aliases) {
  const map = excelFieldMap(row);
  for (const alias of aliases) {
    const key = excelKey(alias);
    if (Object.prototype.hasOwnProperty.call(map, key)) {
      return { found: true, value: map[key] };
    }
  }
  return { found: false, value: undefined };
}

function pickExcelField(row, aliases) {
  const map = excelFieldMap(row);
  for (const alias of aliases) {
    const value = map[excelKey(alias)];
    const text = excelCell(value);
    if (text) return text;
  }
  return '';
}

/** Map a spreadsheet row to a lead — supports simple phone lists and the India worker export. */
function parseLeadImportRow(row) {
  const workerPhone = getExcelField(row, ['WorkerPhone', 'worker_phone']);
  // Literal NULL / empty in WorkerPhone → skip the row, do not fall back to other columns.
  if (workerPhone.found && isExcelBlank(workerPhone.value)) {
    return { phone: '', fullName: '', notes: '' };
  }

  const phone = workerPhone.found
    ? excelCell(workerPhone.value)
    : pickExcelField(row, ['phone', 'Phone', 'mobile', 'Mobile', 'מספר טלפון', 'טלפון']);
  const firstName = pickExcelField(row, ['FirstName', 'first_name', 'first name', 'שם פרטי']);
  const lastName = pickExcelField(row, ['LastName', 'last_name', 'last name', 'שם משפחה']);
  const fullName =
    pickExcelField(row, ['fullName', 'Full Name', 'name', 'שם']) ||
    [firstName, lastName].filter(Boolean).join(' ').trim();
  const passport = pickExcelField(row, ['pasportNo', 'passportNo', 'passport', 'Passport', 'דרכון']);
  const country = pickExcelField(row, ['country_name_EN', 'country_name', 'country', 'Country', 'מדינה']);
  const notes = [passport && `passport ${passport}`, country].filter(Boolean).join(' · ');
  return { phone, fullName, notes };
}

function SelectLeadsScopeModal({ allCount, newCount, onSelectAll, onSelectNews, onClose }) {
  return (
    <div className="modal-overlay z-[60]" onClick={onClose}>
      <div className="modal-content max-w-sm animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="font-bold text-slate-800 text-lg">Select leads</h2>
          <button onClick={onClose} className="action-btn hover:bg-slate-100 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="modal-body space-y-3">
          <p className="text-sm text-slate-600">Who should be selected?</p>
          <button
            type="button"
            onClick={onSelectAll}
            disabled={allCount === 0}
            className="btn-primary w-full justify-center disabled:opacity-40"
          >
            Select all ({allCount})
          </button>
          <button
            type="button"
            onClick={onSelectNews}
            disabled={newCount === 0}
            className="btn-secondary w-full justify-center disabled:opacity-40"
          >
            Only news ({newCount})
          </button>
          <button type="button" onClick={onClose} className="w-full text-sm text-slate-500 hover:text-slate-700 py-1">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function BulkSendWhatsAppModal({ leads, templates, onClose, onStart }) {
  const [templateId, setTemplateId] = useState('');
  const [error, setError] = useState('');

  const activeTemplates = templates.filter((t) => t.isActive !== false);
  const selectedTemplate = activeTemplates.find((t) => t.id === templateId);
  const previewLead = leads[0];

  const preview = (() => {
    if (!selectedTemplate || !previewLead) return '';
    let body = selectedTemplate.bodyPreview || '';
    const vars = selectedTemplate.variables || ['fullName'];
    const defaults = selectedTemplate.variableDefaults || [];
    vars.forEach((key, i) => {
      let val;
      if (key === 'fullName') val = previewLead.fullName?.trim() || 'there';
      else if (key === 'phone') val = previewLead.phone || defaults[i] || '';
      else val = previewLead[key] || defaults[i] || '';
      body = body.replace(new RegExp(`\\{\\{${i + 1}\\}\\}`, 'g'), val);
      body = body.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val);
    });
    return body;
  })();

  const handleSend = () => {
    if (!templateId) {
      setError('Select a template');
      return;
    }
    const result = onStart({
      templateId,
      leadIds: leads.map((l) => l.id),
      templateName: selectedTemplate
        ? `${selectedTemplate.name}${selectedTemplate.language ? ` (${selectedTemplate.language})` : ''}`
        : 'template',
    });
    if (!result?.ok) {
      setError(result?.error || 'Could not start send');
      return;
    }
    onClose();
  };

  return (
    <div className="modal-overlay z-[60]" onClick={onClose}>
      <div className="modal-content max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="font-bold text-slate-800 text-lg">Bulk send template</h2>
          <button onClick={onClose} className="action-btn hover:bg-slate-100 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="modal-body space-y-4">
          <p className="text-sm text-slate-600">
            Send to <strong>{leads.length}</strong> lead{leads.length === 1 ? '' : 's'}:
          </p>
          <ul className="max-h-28 overflow-y-auto rounded-xl bg-slate-50 border border-slate-200 divide-y divide-slate-100 text-sm">
            {leads.map((l) => (
              <li key={l.id} className="px-3 py-2 text-slate-700">
                {l.phone}{l.fullName ? ` · ${l.fullName}` : ''}
              </li>
            ))}
          </ul>
          {activeTemplates.length === 0 ? (
            <p className="text-amber-700 bg-amber-50 rounded-xl px-4 py-3 text-sm border border-amber-100">
              No approved WhatsApp templates found.
            </p>
          ) : (
            <>
              <div>
                <label className="label">Template *</label>
                <select
                  className="input-field"
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                >
                  <option value="">Select template…</option>
                  {activeTemplates.map((t) => (
                    <option key={t.id} value={t.id} disabled={t.metaApproved === false}>
                      {t.name}{t.language ? ` (${t.language})` : ''}
                      {t.metaApproved === false ? ' — not approved on WhatsApp' : ''}
                    </option>
                  ))}
                </select>
              </div>
              {preview && (
                <div>
                  <label className="label">Preview (first lead)</label>
                  <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap">{preview}</div>
                </div>
              )}
            </>
          )}
          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-xl px-4 py-2.5 text-sm border border-red-100">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button
              type="button"
              onClick={handleSend}
              disabled={activeTemplates.length === 0}
              className="btn-primary flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Send to {leads.length}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SendWhatsAppModal({ lead, templates, onClose, onSent }) {
  const [templateId, setTemplateId] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const activeTemplates = templates.filter((t) => t.isActive !== false);
  const selected = activeTemplates.find((t) => t.id === templateId);

  const preview = (() => {
    if (!selected) return '';
    let body = selected.bodyPreview || '';
    const vars = selected.variables || ['fullName'];
    const defaults = selected.variableDefaults || [];
    vars.forEach((key, i) => {
      let val;
      if (key === 'fullName') val = lead.fullName?.trim() || 'there';
      else if (key === 'phone') val = lead.phone || defaults[i] || '';
      else val = lead[key] || defaults[i] || '';
      body = body.replace(new RegExp(`\\{\\{${i + 1}\\}\\}`, 'g'), val);
      body = body.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val);
    });
    return body;
  })();

  const handleSend = async () => {
    if (!templateId) {
      setError('Select a template');
      return;
    }
    setSending(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/leads/${lead.id}/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Send failed');
      onSent(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="modal-overlay z-[60]" onClick={onClose}>
      <div className="modal-content max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="font-bold text-slate-800 text-lg">Send template</h2>
          <button onClick={onClose} className="action-btn hover:bg-slate-100 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="modal-body space-y-4">
          <p className="text-sm text-slate-600">To: <strong>{lead.phone}</strong>{lead.fullName ? ` (${lead.fullName})` : ''}</p>
          {activeTemplates.length === 0 ? (
            <p className="text-amber-700 bg-amber-50 rounded-xl px-4 py-3 text-sm border border-amber-100">
              No approved WhatsApp templates found. Create and approve templates in Meta WhatsApp Manager.
            </p>
          ) : (
            <>
              <div>
                <label className="label">Template *</label>
                <select
                  className="input-field"
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                >
                  <option value="">Select template…</option>
                  {activeTemplates.map((t) => (
                    <option key={t.id} value={t.id} disabled={t.metaApproved === false}>
                      {t.name}{t.language ? ` (${t.language})` : ''}
                      {t.metaApproved === false ? ' — not approved on WhatsApp' : ''}
                    </option>
                  ))}
                </select>
              </div>
              {preview && (
                <div>
                  <label className="label">Preview</label>
                  <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap">{preview}</div>
                </div>
              )}
            </>
          )}
          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-xl px-4 py-2.5 text-sm border border-red-100">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || activeTemplates.length === 0}
              className="btn-primary flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LeadDetailModal({ lead, templates, onClose, onUpdated }) {
  const [form, setForm] = useState({
    fullName: lead.fullName || '',
    status: lead.status || 'new',
    notes: lead.notes || '',
  });
  const [messages, setMessages] = useState([]);
  const [conversationWindowOpen, setConversationWindowOpen] = useState(false);
  const [conversationWindowOpenUntil, setConversationWindowOpenUntil] = useState(null);
  const [loadingMsg, setLoadingMsg] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showSend, setShowSend] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const chatEndRef = useRef(null);

  const loadMessages = useCallback(async (silent = false) => {
    if (!silent) setLoadingMsg(true);
    try {
      const res = await fetch(`${API_BASE}/leads/${lead.id}/messages`);
      const data = await res.json();
      if (res.ok) {
        const list = Array.isArray(data) ? data : (data.messages || []);
        setMessages([...list].reverse());
        if (!Array.isArray(data)) {
          setConversationWindowOpen(!!data.conversationWindowOpen);
          setConversationWindowOpenUntil(data.conversationWindowOpenUntil || null);
        }
      }
    } finally {
      if (!silent) setLoadingMsg(false);
    }
  }, [lead.id]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  useEffect(() => {
    const interval = setInterval(() => loadMessages(true), 8000);
    return () => clearInterval(interval);
  }, [loadMessages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      onUpdated(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSent = (data) => {
    setShowSend(false);
    onUpdated(data.lead);
    loadMessages(true);
  };

  const handleSendReply = async () => {
    const text = replyText.trim();
    if (!text) return;
    setSendingReply(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/leads/${lead.id}/send-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Send failed');
      setReplyText('');
      onUpdated(data.lead);
      setConversationWindowOpen(!!data.conversationWindowOpen);
      loadMessages(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSendingReply(false);
    }
  };

  const hasOutbound = messages.some((m) => m.direction === 'outbound');

  return (
    <>
      <div className="modal-overlay z-50" onClick={onClose}>
        <div className="modal-content max-w-2xl animate-slide-up max-h-[92vh] flex flex-col p-0 overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header shrink-0 border-b border-slate-100">
            <div>
              <h2 className="font-bold text-slate-800 text-lg">{lead.phone}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${statusMeta(lead.status).className}`}>
                  {statusMeta(lead.status).label}
                </span>
                {conversationWindowOpen ? (
                  <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                    Reply window open
                  </span>
                ) : (
                  <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                    Template required
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="action-btn hover:bg-slate-100 text-slate-400">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/80 shrink-0">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                className="input-field text-sm py-2"
                value={form.fullName}
                onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                placeholder="Full name"
              />
              <select
                className="input-field text-sm py-2"
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <button type="button" onClick={handleSave} disabled={saving} className="btn-secondary text-sm py-2">
                {saving ? 'Saving…' : 'Save details'}
              </button>
            </div>
            <input
              className="input-field text-sm py-2 mt-2"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Notes (optional)"
            />
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 bg-slate-50/50 min-h-[280px]">
            {loadingMsg ? (
              <p className="text-sm text-slate-400 text-center py-8">Loading conversation…</p>
            ) : messages.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No messages yet</p>
                <p className="text-xs mt-1">After the call, send the first message using a template</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {messages.map((m) => {
                  const isInbound = m.direction === 'inbound';
                  return (
                    <li key={m.id} className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm border ${
                          isInbound
                            ? 'bg-white border-slate-200 text-slate-800 rounded-tl-sm'
                            : 'bg-indigo-600 border-indigo-600 text-white rounded-tr-sm'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.body || m.inboundBody || '—'}</p>
                        <div className={`flex flex-wrap gap-2 mt-1.5 text-[10px] ${isInbound ? 'text-slate-400' : 'text-indigo-200'}`}>
                          <span>{m.sentAt ? new Date(m.sentAt).toLocaleString() : ''}</span>
                          {!isInbound && m.messageType === 'template' && <span>· template</span>}
                          {!isInbound && m.status && <span>· {m.status}</span>}
                        </div>
                      </div>
                    </li>
                  );
                })}
                <li ref={chatEndRef} />
              </ul>
            )}
          </div>

          <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 space-y-2">
            {error && (
              <div className="text-red-600 bg-red-50 rounded-lg px-3 py-2 text-xs border border-red-100">{error}</div>
            )}

            {!hasOutbound && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
                First message must be an approved template (after your phone call).
              </p>
            )}

            {conversationWindowOpen ? (
              <div className="flex gap-2 items-end">
                <textarea
                  className="input-field flex-1 min-h-[44px] max-h-28 text-sm resize-none py-2.5"
                  rows={2}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type a reply…"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendReply();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleSendReply}
                  disabled={sendingReply || !replyText.trim()}
                  className="btn-primary px-4 py-2.5 shrink-0"
                >
                  {sendingReply ? '…' : <Send className="w-4 h-4" />}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowSend(true)}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                Send template
              </button>
            )}

            {conversationWindowOpen && (
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-slate-400">
                  {conversationWindowOpenUntil
                    ? `Window until ${new Date(conversationWindowOpenUntil).toLocaleString()}`
                    : '24h reply window active'}
                </p>
                <button type="button" onClick={() => setShowSend(true)} className="text-xs text-indigo-600 hover:underline">
                  Send template instead
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {showSend && (
        <SendWhatsAppModal
          lead={{ ...lead, ...form }}
          templates={templates}
          onClose={() => setShowSend(false)}
          onSent={handleSent}
        />
      )}
    </>
  );
}

function AddLeadModal({ onClose, onCreated }) {
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!phone.trim()) {
      setError('Phone is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, fullName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Create failed');
      onCreated(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay z-50" onClick={onClose}>
      <div className="modal-content max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="font-bold text-slate-800 text-lg">Add lead</h2>
          <button onClick={onClose} className="action-btn hover:bg-slate-100 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body space-y-4">
          <div>
            <label className="label">Phone *</label>
            <PhoneInput value={phone} onChange={setPhone} />
          </div>
          <div>
            <label className="label">Full name</label>
            <input className="input-field" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Add'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LeadsPanel({ authUser, openLeadId = null, onOpenLeadHandled }) {
  const { job, startBulkSend } = useBulkSend();
  const [subTab, setSubTab] = useState('leads');
  const [leads, setLeads] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedLead, setSelectedLead] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [selectedLeadIds, setSelectedLeadIds] = useState(() => new Set());
  const [showBulkSend, setShowBulkSend] = useState(false);
  const [showSelectAll, setShowSelectAll] = useState(false);
  const fileInputRef = useRef(null);

  const load = useCallback(async (opts = {}) => {
    const silent = opts.silent === true;
    if (!silent) setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      const qs = params.toString();
      const [leadsRes, tplRes] = await Promise.all([
        fetch(`${API_BASE}/leads${qs ? `?${qs}` : ''}`),
        fetch(`${API_BASE}/message-templates`),
      ]);
      const leadsData = await leadsRes.json();
      const tplData = await tplRes.json();
      if (!leadsRes.ok) throw new Error(leadsData.error || 'Failed to load leads');
      setLeads(leadsData);
      if (tplRes.ok) setTemplates(tplData);
    } catch (err) {
      if (!silent) setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const interval = setInterval(() => load({ silent: true }), 15_000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (!openLeadId || loading) return;
    const lead = leads.find((l) => l.id === openLeadId);
    if (lead) {
      setSelectedLead(lead);
      onOpenLeadHandled?.();
    }
  }, [openLeadId, leads, loading, onOpenLeadHandled]);

  const handleImportClick = () => {
    setImportError(null);
    fileInputRef.current.value = '';
    fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportError('');
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
      const mapped = rows.map(parseLeadImportRow);
      const parsed = mapped.filter((r) => r.phone);
      const skippedEmpty = mapped.length - parsed.length;

      if (parsed.length === 0) {
        setImportError('No valid phone rows found. Expected WorkerPhone / phone / Phone / מספר טלפון');
        return;
      }

      const res = await fetch(`${API_BASE}/leads/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads: parsed }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Import failed');
      await load();
      const parts = [`Imported ${result.imported} leads`];
      if (result.skipped) parts.push(`${result.skipped} skipped as duplicates`);
      if (skippedEmpty) parts.push(`${skippedEmpty} ignored (empty WorkerPhone)`);
      alert(parts.join(' · '));
    } catch (err) {
      setImportError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const filteredLeads = statusFilter
    ? leads.filter((l) => l.status === statusFilter)
    : leads;

  const selectedLeads = filteredLeads.filter((l) => selectedLeadIds.has(l.id));
  const newFilteredLeads = filteredLeads.filter((l) => l.status === 'new');
  const allVisibleSelected =
    filteredLeads.length > 0 && filteredLeads.every((l) => selectedLeadIds.has(l.id));

  const toggleLeadSelection = (leadId) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  };

  const clearVisibleSelection = () => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      filteredLeads.forEach((l) => next.delete(l.id));
      return next;
    });
  };

  const selectVisibleLeads = (onlyNew) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      filteredLeads.forEach((l) => {
        if (!onlyNew || l.status === 'new') next.add(l.id);
        else next.delete(l.id);
      });
      return next;
    });
    setShowSelectAll(false);
  };

  const handleHeaderSelectClick = () => {
    if (allVisibleSelected) {
      clearVisibleSelection();
      return;
    }
    setShowSelectAll(true);
  };

  const handleBulkSendStart = (payload) => {
    const result = startBulkSend(payload);
    if (result?.ok) {
      setShowBulkSend(false);
      setSelectedLeadIds(new Set());
    }
    return result;
  };

  useEffect(() => {
    if (!job || job.done === 0) return undefined;
    load({ silent: true });
    return undefined;
  }, [job?.done, job?.status, load]);

  const counts = STATUS_OPTIONS.reduce((acc, s) => {
    acc[s.value] = leads.filter((l) => l.status === s.value).length;
    return acc;
  }, {});

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex gap-1.5 bg-slate-100 rounded-xl p-1 w-fit">
        <button
          type="button"
          onClick={() => setSubTab('leads')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${subTab === 'leads' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'}`}
        >
          <UserPlus className="w-4 h-4" />
          Leads
        </button>
        {authUser?.isAdmin && (
          <button
            type="button"
            onClick={() => setSubTab('templates')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${subTab === 'templates' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'}`}
          >
            <List className="w-4 h-4" />
            Templates
          </button>
        )}
      </div>

      {subTab === 'templates' ? (
        <MessageTemplatesPanel />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setStatusFilter(statusFilter === s.value ? '' : s.value)}
                className={`stat-card text-left border-l-4 transition-all ${statusFilter === s.value ? 'ring-2 ring-indigo-400' : ''}`}
              >
                <div className="text-2xl font-extrabold text-slate-800">{counts[s.value] ?? 0}</div>
                <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                className="input-field pl-9"
                placeholder="Search phone or name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button type="button" onClick={load} className="btn-secondary flex items-center gap-2">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button type="button" onClick={() => setShowAdd(true)} className="btn-secondary flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add
            </button>
            <button
              type="button"
              onClick={handleImportClick}
              disabled={importing}
              title="Supports WorkerPhone + FirstName/LastName, or a phone / fullName column"
              className="btn-primary flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              {importing ? 'Importing…' : 'Import Excel'}
            </button>
            {selectedLeads.length > 0 && (
              <button
                type="button"
                onClick={() => setShowBulkSend(true)}
                disabled={job?.status === 'running'}
                title={job?.status === 'running' ? 'A send is already running' : undefined}
                className="btn-success flex items-center gap-2 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                Send template ({selectedLeads.length})
              </button>
            )}
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
          </div>

          {importError && (
            <div className="text-red-600 bg-red-50 rounded-xl px-4 py-2.5 text-sm border border-red-100">{importError}</div>
          )}
          {error && (
            <div className="text-red-600 bg-red-50 rounded-xl px-4 py-2.5 text-sm border border-red-100">{error}</div>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-left">
                  <th className="px-3 py-3 font-semibold w-10">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={handleHeaderSelectClick}
                      disabled={filteredLeads.length === 0}
                      className="w-4 h-4 accent-indigo-600 cursor-pointer rounded disabled:opacity-40"
                      title="Select leads"
                    />
                  </th>
                  <th className="px-4 py-3 font-semibold">Phone</th>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Alert</th>
                  <th className="px-4 py-3 font-semibold">Last contacted</th>
                  <th className="px-4 py-3 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Loading…</td></tr>
                ) : filteredLeads.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No leads yet — import or add one</td></tr>
                ) : (
                  filteredLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      className={`border-t border-slate-100 hover:bg-indigo-50/30 cursor-pointer ${lead.needsReply ? 'bg-amber-50/60' : ''} ${selectedLeadIds.has(lead.id) ? 'bg-indigo-50/50' : ''}`}
                      onClick={() => setSelectedLead(lead)}
                    >
                      <td
                        className="px-3 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedLeadIds.has(lead.id)}
                          onChange={() => toggleLeadSelection(lead.id)}
                          className="w-4 h-4 accent-indigo-600 cursor-pointer rounded"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        <span className="inline-flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          {lead.phone}
                          {lead.needsReply && (
                            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" title="New message" />
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{lead.fullName || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${statusMeta(lead.status).className}`}>
                          {statusMeta(lead.status).label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs max-w-[220px]">
                        {lead.alertText ? (
                          <span className="inline-flex items-start gap-1.5 text-amber-800 bg-amber-100 border border-amber-200 rounded-lg px-2 py-1 leading-snug">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span className="line-clamp-2">{lead.alertText}</span>
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {lead.lastContactedAt ? new Date(lead.lastContactedAt).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showAdd && (
        <AddLeadModal
          onClose={() => setShowAdd(false)}
          onCreated={(created) => {
            setShowAdd(false);
            setLeads((prev) => [created, ...prev]);
            setSelectedLead(created);
          }}
        />
      )}

      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          templates={templates}
          onClose={() => setSelectedLead(null)}
          onUpdated={(updated) => {
            setSelectedLead(updated);
            setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
          }}
        />
      )}

      {showSelectAll && (
        <SelectLeadsScopeModal
          allCount={filteredLeads.length}
          newCount={newFilteredLeads.length}
          onSelectAll={() => selectVisibleLeads(false)}
          onSelectNews={() => selectVisibleLeads(true)}
          onClose={() => setShowSelectAll(false)}
        />
      )}

      {showBulkSend && selectedLeads.length > 0 && (
        <BulkSendWhatsAppModal
          leads={selectedLeads}
          templates={templates}
          onClose={() => setShowBulkSend(false)}
          onStart={handleBulkSendStart}
        />
      )}
    </div>
  );
}
