import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Pencil, X, AlertCircle, MessageSquare, RefreshCw } from 'lucide-react';
import { API_BASE } from '../config';

const LANGS = [
  { id: 'en', label: 'English (en)' },
  { id: 'he', label: 'Hebrew (he)' },
  { id: 'hi', label: 'Hindi (hi)' },
  { id: 'th', label: 'Thai (th)' },
];

const CATEGORIES = [
  { id: 'UTILITY', label: 'Utility' },
  { id: 'MARKETING', label: 'Marketing' },
  { id: 'AUTHENTICATION', label: 'Authentication' },
];

function toWaName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function listPlaceholders(text) {
  return [...String(text || '').matchAll(/\{\{([^}]+)\}\}/g)].map((m) => String(m[1]).trim());
}

function statusMeta(status) {
  const s = String(status || 'LOCAL').toUpperCase();
  const map = {
    APPROVED: { label: 'Approved', cls: 'bg-emerald-100 text-emerald-800' },
    PENDING: { label: 'Pending approval', cls: 'bg-amber-100 text-amber-800' },
    REJECTED: { label: 'Rejected', cls: 'bg-red-100 text-red-800' },
    PAUSED: { label: 'Paused', cls: 'bg-slate-100 text-slate-600' },
    DISABLED: { label: 'Disabled', cls: 'bg-slate-100 text-slate-600' },
    LOCAL: { label: 'Not submitted', cls: 'bg-slate-100 text-slate-500' },
  };
  return map[s] || { label: s, cls: 'bg-slate-100 text-slate-600' };
}

function MetaStatusBadge({ status }) {
  const item = statusMeta(status);
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${item.cls}`}>
      {item.label}
    </span>
  );
}

function TemplateFormModal({ template, onSave, onClose }) {
  const isEdit = !!template;
  const lockedOnMeta = isEdit && !!(template.metaId || (template.source || '').includes('meta'));
  const [form, setForm] = useState({
    name: template?.name || '',
    waTemplateName: template?.waTemplateName || '',
    language: template?.language || 'en',
    category: template?.category || 'UTILITY',
    headerText: template?.headerText || '',
    bodyPreview: template?.bodyPreview || '',
    footerText: template?.footerText || '',
    exampleValues: Array.isArray(template?.exampleValues)
      ? template.exampleValues
      : Array.isArray(template?.variableDefaults)
        ? template.variableDefaults
        : [],
    isActive: template?.isActive !== false,
    submitToMeta: !isEdit || ['LOCAL', 'REJECTED'].includes(String(template?.metaStatus || 'LOCAL').toUpperCase()),
  });
  const [waNameTouched, setWaNameTouched] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const placeholders = useMemo(() => listPlaceholders(form.bodyPreview), [form.bodyPreview]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const waName = toWaName(form.waTemplateName || form.name);
    if (!form.name.trim() || !waName) {
      setError('Name and Meta template name are required');
      return;
    }
    if (form.submitToMeta && !form.bodyPreview.trim()) {
      setError('Template body is required to submit to Meta');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        waTemplateName: waName,
        language: form.language.trim() || 'en',
        category: form.category,
        headerText: form.headerText.trim(),
        bodyPreview: form.bodyPreview.trim(),
        footerText: form.footerText.trim(),
        exampleValues: placeholders.map((_, i) => String(form.exampleValues[i] || '').trim()),
        variables: placeholders.map((p, i) => (/^\d+$/.test(p) ? (i === 0 ? 'fullName' : `var${i + 1}`) : p)),
        isActive: form.isActive,
        submitToMeta: form.submitToMeta,
        metaId: template?.metaId || null,
      };
      const url = isEdit
        ? `${API_BASE}/message-templates/${template.id}`
        : `${API_BASE}/message-templates`;
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      onSave(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay z-50" onClick={onClose}>
      <div className="modal-content max-w-lg animate-slide-up max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="font-bold text-slate-800 text-lg">
            {isEdit ? 'Edit template' : 'New template'}
          </h2>
          <button onClick={onClose} className="action-btn hover:bg-slate-100 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body space-y-4">
          <div>
            <label className="label">Display name *</label>
            <input
              className="input-field"
              value={form.name}
              onChange={(e) => {
                const name = e.target.value;
                setForm((p) => ({
                  ...p,
                  name,
                  waTemplateName: !waNameTouched ? toWaName(name) : p.waTemplateName,
                }));
              }}
              placeholder="First contact"
              required
            />
          </div>
          <div>
            <label className="label">Meta template name *</label>
            <input
              className="input-field"
              value={form.waTemplateName}
              onChange={(e) => {
                setWaNameTouched(true);
                setForm((p) => ({ ...p, waTemplateName: e.target.value }));
              }}
              placeholder="new_customer_no_answer"
              required
              disabled={lockedOnMeta}
            />
            <p className="text-xs text-slate-500 mt-1">
              {lockedOnMeta
                ? 'Meta name and language cannot change after submit.'
                : 'Lowercase letters, numbers, and underscores. Submitted to WhatsApp for approval.'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Language</label>
              <select
                className="input-field"
                value={form.language}
                onChange={(e) => setForm((p) => ({ ...p, language: e.target.value }))}
                disabled={lockedOnMeta}
              >
                {LANGS.map((l) => (
                  <option key={l.id} value={l.id}>{l.label}</option>
                ))}
                {form.language && !LANGS.some((l) => l.id === form.language) && (
                  <option value={form.language}>{form.language}</option>
                )}
              </select>
            </div>
            <div>
              <label className="label">Category</label>
              <select
                className="input-field"
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Header (optional)</label>
            <input
              className="input-field"
              value={form.headerText}
              onChange={(e) => setForm((p) => ({ ...p, headerText: e.target.value }))}
              placeholder="ISA Shipping"
            />
          </div>
          <div>
            <label className="label">Body *</label>
            <textarea
              className="input-field min-h-[100px]"
              value={form.bodyPreview}
              onChange={(e) => setForm((p) => ({ ...p, bodyPreview: e.target.value }))}
              placeholder="Hello {{fullName}}, we tried calling you about your shipment."
            />
            <p className="text-xs text-slate-500 mt-1">
              Use {'{{1}}'} or {'{{fullName}}'} for variables. Meta reviews this text before you can send it.
            </p>
          </div>
          {placeholders.length > 0 && (
            <div className="space-y-2">
              <label className="label">Example values for Meta review</label>
              {placeholders.map((p, i) => (
                <input
                  key={`${p}-${i}`}
                  className="input-field"
                  value={form.exampleValues[i] || ''}
                  onChange={(e) => {
                    const next = [...form.exampleValues];
                    next[i] = e.target.value;
                    setForm((prev) => ({ ...prev, exampleValues: next }));
                  }}
                  placeholder={`Example for {{${p}}}`}
                />
              ))}
            </div>
          )}
          <div>
            <label className="label">Footer (optional)</label>
            <input
              className="input-field"
              value={form.footerText}
              onChange={(e) => setForm((p) => ({ ...p, footerText: e.target.value }))}
              placeholder="Reply STOP to unsubscribe"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
            />
            Active in send list (after Meta approval)
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={form.submitToMeta}
              onChange={(e) => setForm((p) => ({ ...p, submitToMeta: e.target.checked }))}
            />
            <span>
              {isEdit && lockedOnMeta
                ? 'Send changes to Meta (content edits usually need re-approval)'
                : 'Submit to Meta for approval'}
            </span>
          </label>
          {template?.rejectedReason && !/^none$/i.test(String(template.rejectedReason).trim()) && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              Last rejection: {template.rejectedReason}
            </p>
          )}
          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-xl px-4 py-2.5 text-sm border border-red-100">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : form.submitToMeta ? (template?.metaId ? 'Save & update Meta' : 'Submit to Meta') : 'Save locally'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function MessageTemplatesPanel() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/message-templates?active=0`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load templates');
      setTemplates(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaved = () => {
    setShowForm(false);
    setEditing(null);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-slate-500">
          Create a template here and submit it to Meta. You can send it only after it is approved. Refresh to pick up the latest Meta status.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            className="btn-secondary flex items-center gap-2"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add template
          </button>
        </div>
      </div>

      {error && (
        <div className="text-red-600 bg-red-50 rounded-xl px-4 py-2.5 text-sm border border-red-100">{error}</div>
      )}

      {loading ? (
        <div className="text-slate-500 text-sm py-8 text-center">Loading templates…</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>No templates yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-left">
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Meta name</th>
                <th className="px-4 py-3 font-semibold">Lang</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Active</th>
                <th className="px-4 py-3 font-semibold w-16"></th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-slate-800">{t.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{t.waTemplateName}</td>
                  <td className="px-4 py-3">{t.language || 'en'}</td>
                  <td className="px-4 py-3">
                    <MetaStatusBadge status={t.metaStatus} />
                    {t.metaStatus === 'REJECTED' && t.rejectedReason && (
                      <p className="text-xs text-red-500 mt-1 max-w-xs truncate" title={t.rejectedReason}>
                        {t.rejectedReason}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${t.isActive !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                      {t.isActive !== false ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => { setEditing(t); setShowForm(true); }}
                      className="action-btn hover:bg-slate-100 text-slate-500"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <TemplateFormModal
          template={editing}
          onSave={handleSaved}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}
