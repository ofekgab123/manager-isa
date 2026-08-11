import { useState, useEffect, useCallback } from 'react';
import {
  List,
  Plus,
  Pencil,
  Trash2,
  X,
  AlertCircle,
  Package,
} from 'lucide-react';
import { API_BASE } from '../config';

const DEFAULT_LABELS = [
  'Food Products',
  'Cosmetics',
  'Clothes',
  'Shoes',
  'Pillows',
  'Blanket',
  'Bed Linen',
  'Kitchen Tools',
  'Dishes',
  'Cans',
  'Detergent',
  'Home Chemicals',
  'Personal Hygiene',
  'Toys',
];

function ParcelContentTypeFormModal({ type, onSave, onClose }) {
  const isEdit = !!type;
  const [label, setLabel] = useState(type?.label || '');
  const [valueIls, setValueIls] = useState(
    type?.valueIls != null && type?.valueIls !== '' ? String(type.valueIls) : '0'
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLabel(type?.label || '');
    setValueIls(type?.valueIls != null && type?.valueIls !== '' ? String(type.valueIls) : '0');
  }, [type]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!label.trim()) {
      setError('Label is required');
      return;
    }
    setSaving(true);
    try {
      const url = isEdit
        ? `${API_BASE}/parcel-content-types/${type.id}`
        : `${API_BASE}/parcel-content-types`;
      const method = isEdit ? 'PATCH' : 'POST';
      const parsedIls = Math.max(0, parseFloat(String(valueIls).replace(',', '.')) || 0);
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label.trim(), valueIls: parsedIls }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save error');
      onSave(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-overlay z-50"
      onClick={onClose}
    >
      <div
        className="modal-content max-w-md animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="font-bold text-slate-800 text-lg">
            {isEdit ? 'Edit parcel type' : 'New parcel type'}
          </h2>
          <button onClick={onClose} className="action-btn hover:bg-slate-100 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body space-y-4">
          <div>
            <label className="label">
              Description label *
            </label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Food Products"
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="label">
              Default unit value (₪)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={valueIls}
              onChange={(e) => setValueIls(e.target.value)}
              className="input-field"
            />
            <p className="text-xs text-slate-500 mt-1">Applied per quantity unit when choosing this type on a parcel line.</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-xl px-4 py-2.5 text-sm border border-red-100">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
        </form>
        <div className="modal-footer">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            onClick={handleSubmit}
            className="btn-primary flex-1"
          >
            {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Add type'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ParcelContentTypesPanel({ embedded = false }) {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [seeding, setSeeding] = useState(false);

  const fetchTypes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/parcel-content-types`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setTypes(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
      setTypes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTypes();
  }, [fetchTypes]);

  const handleSeedDefaults = async () => {
    setSeeding(true);
    try {
      for (const label of DEFAULT_LABELS) {
        await fetch(`${API_BASE}/parcel-content-types`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label, valueIls: 0 }),
        });
      }
      await fetchTypes();
    } catch {
      setError('Failed to seed defaults');
    } finally {
      setSeeding(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this parcel type?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${API_BASE}/parcel-content-types/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete');
      await fetchTypes();
    } catch {
      setError('Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSave = (saved) => {
    setTypes((prev) => {
      const idx = prev.findIndex((t) => t.id === saved.id);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [...prev, saved];
    });
    setShowForm(false);
    setEditingType(null);
  };

  return (
    <div className={embedded ? 'space-y-6' : 'space-y-6 animate-fade-in'}>
      <div className="stat-card border-l-4 border-indigo-500">
        <div className="text-3xl font-extrabold text-slate-800">{types.length}</div>
        <div className="text-sm text-slate-500 mt-1">Parcel content types</div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="section-title">
            <List className="w-5 h-5 text-indigo-500" />
            Parcel Content Types ({types.length})
          </h2>
          <div className="flex items-center gap-2">
            {types.length === 0 && (
              <button
                onClick={handleSeedDefaults}
                disabled={seeding}
                className="btn-amber"
              >
                <Package className="w-4 h-4" />
                {seeding ? 'Seeding...' : 'Initialize with defaults'}
              </button>
            )}
            <button
              onClick={() => {
                setEditingType(null);
                setShowForm(true);
              }}
              className="btn-primary"
            >
              <Plus className="w-4 h-4" />
              New type
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading...</div>
        ) : error ? (
          <div className="p-12 text-center text-red-600">{error}</div>
        ) : types.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <List className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-base font-medium text-slate-500">No parcel content types</p>
            <p className="text-sm text-slate-400 mt-1">
              Click &quot;Initialize with defaults&quot; or &quot;New type&quot; to add
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-center">
              <thead>
                <tr className="table-header">
                  <th>Label</th>
                  <th>Unit (₪)</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {types.map((t) => (
                  <tr
                    key={t.id}
                    className="table-row"
                  >
                    <td className="font-medium text-slate-800">
                      {t.label}
                    </td>
                    <td className="text-slate-700 tabular-nums">
                      {new Intl.NumberFormat('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(t.valueIls) || 0)}
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          onClick={() => {
                            setEditingType(t);
                            setShowForm(true);
                          }}
                          className="action-btn hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(t.id)}
                          disabled={deletingId === t.id}
                          className="action-btn hover:bg-red-50 text-slate-400 hover:text-red-600 disabled:opacity-50"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <ParcelContentTypeFormModal
          type={editingType}
          onSave={handleSave}
          onClose={() => {
            setShowForm(false);
            setEditingType(null);
          }}
        />
      )}
    </div>
  );
}
