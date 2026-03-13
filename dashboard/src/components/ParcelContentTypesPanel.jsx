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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label.trim() }),
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-slate-800 text-lg">
            {isEdit ? 'Edit parcel type' : 'New parcel type'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Description label *
            </label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Food Products"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              required
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg px-3 py-2 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold disabled:opacity-50"
            >
              {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Add type'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ParcelContentTypesPanel() {
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
          body: JSON.stringify({ label }),
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
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        <div className="text-2xl font-bold text-slate-800">{types.length}</div>
        <div className="text-sm text-slate-500">Parcel content types</div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <List className="w-5 h-5" />
            Parcel Content Types ({types.length})
          </h2>
          <div className="flex items-center gap-2">
            {types.length === 0 && (
              <button
                onClick={handleSeedDefaults}
                disabled={seeding}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
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
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              New type
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-600">{error}</div>
        ) : types.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <List className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>No parcel content types</p>
            <p className="text-sm mt-1">
              Click &quot;Initialize with defaults&quot; or &quot;New type&quot; to add
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-center">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase">
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Label</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {types.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-slate-100 hover:bg-slate-50/50"
                  >
                    <td className="px-4 py-3 font-mono text-sm text-slate-500">
                      {t.id}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {t.label}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => {
                            setEditingType(t);
                            setShowForm(true);
                          }}
                          className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(t.id)}
                          disabled={deletingId === t.id}
                          className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-600 disabled:opacity-50"
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
