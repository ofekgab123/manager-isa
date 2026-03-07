import { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Pencil, Trash2, X, Save, MapPin, Search } from 'lucide-react';
import AddressPicker from './AddressPicker';
import PhoneInput from './PhoneInput';
import { API_BASE } from '../config';

const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200';

/* ─── User form modal ─────────────────────────────────────────── */
function UserFormModal({ user, onSave, onClose }) {
  const isEdit = !!user;
  const [form, setForm] = useState({
    fullName: user?.fullName || '',
    phone:    user?.phone    || '',
    notes:    user?.notes    || '',
  });
  const [address, setAddress]     = useState(user?.address || null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSave = async () => {
    if (!form.fullName.trim()) { setError('Name is required'); return; }
    setSaving(true); setError('');
    try {
      const url    = isEdit ? `${API_BASE}/users/${user.id}` : `${API_BASE}/users`;
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, address }),
      });
      if (!res.ok) throw new Error('Save error');
      onSave(await res.json());
    } catch (e) {
      setError(e.message || 'Error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-bold text-slate-800">{isEdit ? 'Edit User' : 'Add User'}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Full name <span className="text-red-500">*</span></label>
            <input name="fullName" value={form.fullName} onChange={handleChange} placeholder="Full name" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Phone</label>
            <PhoneInput
              value={form.phone}
              onChange={(v) => setForm((p) => ({ ...p, phone: v }))}
              placeholder="501234567"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Address</label>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 border-2 border-dashed rounded-lg text-sm transition-colors ${
                address?.lat
                  ? 'border-green-300 bg-green-50 text-green-700 hover:border-green-400'
                  : 'border-slate-300 text-slate-500 hover:border-indigo-400 hover:bg-indigo-50'
              }`}
            >
              <MapPin className="w-4 h-4 shrink-0" />
              <span className="truncate">{address?.displayAddress || 'Pick on map…'}</span>
            </button>
            {address && (
              <button type="button" onClick={() => setAddress(null)} className="text-xs text-red-500 hover:underline mt-1">
                Clear address
              </button>
            )}
            <AddressPicker
              isOpen={pickerOpen}
              onClose={() => setPickerOpen(false)}
              onSelect={(a) => { setAddress(a); setPickerOpen(false); }}
              initialPosition={address?.lat ? [address.lat, address.lng] : undefined}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
            <textarea name="notes" value={form.notes} onChange={handleChange} rows={2} placeholder="Notes…" className={inputCls} />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>
        <div className="flex gap-2 px-5 py-4 border-t">
          <button onClick={onClose} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add user'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main panel ─────────────────────────────────────────────── */
export default function UsersPanel() {
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [showAdd, setShowAdd]     = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/users`);
      setUsers(await res.json());
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const filtered = users.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (u.fullName || '').toLowerCase().includes(q) ||
      (u.phone    || '').replace(/\D/g, '').includes(q.replace(/\D/g, '')) ||
      (u.address?.displayAddress || '').toLowerCase().includes(q)
    );
  });

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this user?')) return;
    setDeletingId(id);
    try {
      await fetch(`${API_BASE}/users/${id}`, { method: 'DELETE' });
      fetchUsers();
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaved = () => { fetchUsers(); setEditingUser(null); setShowAdd(false); };

  return (
    <section className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <Users className="w-5 h-5" />
          Users ({users.length})
        </h2>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add user
        </button>
      </div>

      {/* Search */}
      <div className="px-5 py-3 border-b">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone or address…"
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <p className="p-8 text-center text-slate-500">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="p-8 text-center text-slate-400">{search ? 'No users match your search' : 'No users yet'}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Phone</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Address</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Notes</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Added</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800 text-sm">{u.fullName || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{u.phone || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-500 max-w-[220px]">
                    {u.address?.displayAddress ? (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                        <MapPin className="w-3 h-3 text-green-500 shrink-0" />
                        <span className="truncate">{u.address.displayAddress}</span>
                      </span>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400 max-w-[150px] truncate">{u.notes || '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-GB') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditingUser(u)}
                        className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(u.id)}
                        disabled={deletingId === u.id}
                        className="p-1.5 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-600 transition-colors disabled:opacity-50"
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

      {showAdd && <UserFormModal onSave={handleSaved} onClose={() => setShowAdd(false)} />}
      {editingUser && <UserFormModal user={editingUser} onSave={handleSaved} onClose={() => setEditingUser(null)} />}
    </section>
  );
}
