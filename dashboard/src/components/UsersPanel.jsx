import { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Pencil, Trash2, X, Save, ShieldCheck, Shield, Search, Eye, EyeOff } from 'lucide-react';
import { API_BASE } from '../config';

const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200';

/* ─── Auth user form modal ────────────────────────────────────── */
function AuthUserFormModal({ user, onSave, onClose }) {
  const isEdit = !!user;
  const [form, setForm] = useState({
    username: user?.username || '',
    password: '',
    isAdmin: user?.isAdmin ?? false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((p) => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSave = async () => {
    if (!form.username.trim()) { setError('Username is required'); return; }
    if (!isEdit && !form.password) { setError('Password is required'); return; }
    setSaving(true);
    setError('');
    try {
      const body = { username: form.username.trim(), isAdmin: form.isAdmin };
      if (form.password) body.password = form.password;
      const url    = isEdit ? `${API_BASE}/auth/users/${user.id}` : `${API_BASE}/auth/users`;
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save error');
      onSave(data);
    } catch (e) {
      setError(e.message || 'Error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-bold text-slate-800">{isEdit ? 'Edit User' : 'Add User'}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Username <span className="text-red-500">*</span>
            </label>
            <input
              name="username"
              value={form.username}
              onChange={handleChange}
              placeholder="Username"
              className={inputCls}
              autoComplete="off"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Password {!isEdit && <span className="text-red-500">*</span>}
              {isEdit && <span className="text-slate-400 font-normal">(leave blank to keep current)</span>}
            </label>
            <div className="relative">
              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={handleChange}
                placeholder={isEdit ? 'New password…' : 'Password'}
                className={`${inputCls} pr-10`}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer select-none p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
            <input
              type="checkbox"
              name="isAdmin"
              checked={form.isAdmin}
              onChange={handleChange}
              className="w-4 h-4 accent-indigo-600 cursor-pointer"
            />
            <div className="flex items-center gap-2">
              <ShieldCheck className={`w-4 h-4 ${form.isAdmin ? 'text-indigo-600' : 'text-slate-300'}`} />
              <div>
                <p className="text-sm font-medium text-slate-700">Admin</p>
                <p className="text-xs text-slate-400">Full access including user management</p>
              </div>
            </div>
          </label>
          {error && <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
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
      const res = await fetch(`${API_BASE}/auth/users`);
      setUsers(res.ok ? await res.json() : []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const filtered = users.filter((u) => {
    if (!search.trim()) return true;
    return (u.username || '').toLowerCase().includes(search.toLowerCase());
  });

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this user?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${API_BASE}/auth/users/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Delete failed'); return; }
      fetchUsers();
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaved = () => { fetchUsers(); setEditingUser(null); setShowAdd(false); };

  return (
    <section className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <Users className="w-5 h-5" />
          System Users ({search ? `${filtered.length} / ${users.length}` : users.length})
        </h2>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add user
        </button>
      </div>

      <div className="px-5 py-3 border-b">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by username…"
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="p-8 text-center text-slate-500">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="p-8 text-center text-slate-400">{search ? 'No users match your search' : 'No users yet'}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-center">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Username</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Role</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800 text-sm">{u.username}</td>
                  <td className="px-4 py-3">
                    {u.isAdmin ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-full">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                        <Shield className="w-3.5 h-3.5" />
                        User
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-GB') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-center">
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

      {showAdd && <AuthUserFormModal onSave={handleSaved} onClose={() => setShowAdd(false)} />}
      {editingUser && <AuthUserFormModal user={editingUser} onSave={handleSaved} onClose={() => setEditingUser(null)} />}
    </section>
  );
}
