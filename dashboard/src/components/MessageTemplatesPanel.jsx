import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, X, AlertCircle, MessageSquare } from 'lucide-react';
import { API_BASE } from '../config';

function TemplateFormModal({ template, onSave, onClose }) {
  const isEdit = !!template;
  const [form, setForm] = useState({
    name: template?.name || '',
    waTemplateName: template?.waTemplateName || '',
    language: template?.language || 'en',
    variables: (template?.variables || ['fullName']).join(', '),
    bodyPreview: template?.bodyPreview || '',
    isActive: template?.isActive !== false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.waTemplateName.trim()) {
      setError('Name and Meta template name are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        waTemplateName: form.waTemplateName.trim(),
        language: form.language.trim() || 'en',
        variables: form.variables.split(',').map((s) => s.trim()).filter(Boolean),
        bodyPreview: form.bodyPreview.trim(),
        isActive: form.isActive,
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
      <div className="modal-content max-w-lg animate-slide-up" onClick={(e) => e.stopPropagation()}>
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
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="First contact"
              required
            />
          </div>
          <div>
            <label className="label">Meta template name *</label>
            <input
              className="input-field"
              value={form.waTemplateName}
              onChange={(e) => setForm((p) => ({ ...p, waTemplateName: e.target.value }))}
              placeholder="first_contact_en"
              required
            />
          </div>
          <div>
            <label className="label">Language code</label>
            <input
              className="input-field"
              value={form.language}
              onChange={(e) => setForm((p) => ({ ...p, language: e.target.value }))}
              placeholder="en"
            />
          </div>
          <div>
            <label className="label">Variables (comma-separated)</label>
            <input
              className="input-field"
              value={form.variables}
              onChange={(e) => setForm((p) => ({ ...p, variables: e.target.value }))}
              placeholder="fullName"
            />
          </div>
          <div>
            <label className="label">Preview text</label>
            <textarea
              className="input-field min-h-[80px]"
              value={form.bodyPreview}
              onChange={(e) => setForm((p) => ({ ...p, bodyPreview: e.target.value }))}
              placeholder="Hello {{fullName}}, we tried calling you..."
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
            />
            Active
          </label>
          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-xl px-4 py-2.5 text-sm border border-red-100">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Save'}
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
      const res = await fetch(`${API_BASE}/message-templates`);
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

  const handleSaved = (saved) => {
    setTemplates((prev) => {
      const idx = prev.findIndex((t) => t.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    setShowForm(false);
    setEditing(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-slate-500">
          Map approved Meta templates here. Agents pick from active templates when sending.
        </p>
        <button
          type="button"
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add template
        </button>
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
