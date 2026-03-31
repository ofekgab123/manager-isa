import { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Pencil, Trash2, X, Save, ShieldCheck, Shield, Search, Eye, EyeOff, Globe } from 'lucide-react';
import { API_BASE } from '../config';

/* ─── Auth user form modal ────────────────────────────────────── */
function AuthUserFormModal({ user, onSave, onClose }) {
  const isEdit = !!user;
  const [form, setForm] = useState({
    username: user?.username || '',
    password: '',
    isAdmin: user?.isAdmin ?? false,
    country: user?.country || '',
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
      if (!form.isAdmin) body.country = form.country || null;
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
    <div className="modal-overlay z-50">
      <div className="modal-content max-w-sm animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-bold text-slate-800 text-lg">{isEdit ? 'Edit User' : 'Add User'}</h3>
          <button onClick={onClose} className="action-btn hover:bg-slate-100 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="modal-body space-y-4">
          <div>
            <label className="label">
              Username <span className="text-red-500">*</span>
            </label>
            <input
              name="username"
              value={form.username}
              onChange={handleChange}
              placeholder="Username"
              className="input-field"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="label">
              Password {!isEdit && <span className="text-red-500">*</span>}
              {isEdit && <span className="text-slate-400 font-normal normal-case tracking-normal">(leave blank to keep current)</span>}
            </label>
            <div className="relative">
              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={handleChange}
                placeholder={isEdit ? 'New password…' : 'Password'}
                className="input-field pr-10"
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
          <label className="flex items-center gap-3 cursor-pointer select-none p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
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
          {!form.isAdmin && (
            <div>
              <label className="label">
                Country <span className="text-slate-400 font-normal">(user will only see this country's data)</span>
              </label>
              <select
                name="country"
                value={form.country}
                onChange={handleChange}
                className="input-field"
              >
                <option value="">— All countries (no restriction) —</option>
                <option value="India">India</option>
                <option value="Thailand">Thailand</option>
              </select>
            </div>
          )}
          {error && <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">{error}</p>}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex-1"
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
    <section className="card animate-fade-in">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <h2 className="section-title">
          <Users className="w-5 h-5 text-indigo-500" />
          System Users ({search ? `${filtered.length} / ${users.length}` : users.length})
        </h2>
        <button
          onClick={() => setShowAdd(true)}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" />
          Add user
        </button>
      </div>

      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/30">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by username…"
            className="input-field pl-10"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="p-12 text-center text-slate-500">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-slate-300" />
          </div>
          <p className="text-base font-medium text-slate-500">{search ? 'No users match your search' : 'No users yet'}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-center">
            <thead>
              <tr className="table-header">
                <th>Username</th>
                <th>Role</th>
                <th>Country</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="table-row">
                  <td className="font-medium text-slate-800 text-sm">{u.username}</td>
                  <td>
                    {u.isAdmin ? (
                      <span className="badge-pill text-indigo-700 bg-indigo-50 border border-indigo-200">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Admin
                      </span>
                    ) : (
                      <span className="badge-pill text-slate-500 bg-slate-100">
                        <Shield className="w-3.5 h-3.5" />
                        User
                      </span>
                    )}
                  </td>
                  <td>
                    {u.country ? (
                      <span className="badge-pill text-emerald-700 bg-emerald-50 border border-emerald-200">
                        <Globe className="w-3.5 h-3.5" />
                        {u.country}
                      </span>
                    ) : (
                      <span className="text-slate-300 text-sm">—</span>
                    )}
                  </td>
                  <td className="text-xs text-slate-400 whitespace-nowrap">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-GB') : '—'}
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        onClick={() => setEditingUser(u)}
                        className="action-btn hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(u.id)}
                        disabled={deletingId === u.id}
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

      {showAdd && <AuthUserFormModal onSave={handleSaved} onClose={() => setShowAdd(false)} />}
      {editingUser && <AuthUserFormModal user={editingUser} onSave={handleSaved} onClose={() => setEditingUser(null)} />}
    </section>
  );
}
