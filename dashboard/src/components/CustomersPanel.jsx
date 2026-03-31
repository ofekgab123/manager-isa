import { useState, useEffect, useCallback, useRef } from 'react';
import {
  UserCircle2,
  Plus,
  Pencil,
  Trash2,
  X,
  MapPin,
  Search,
  Phone,
  Save,
  Send,
  Package,
} from 'lucide-react';
import AddressPicker from './AddressPicker';
import PhoneInput from './PhoneInput';
import { API_BASE } from '../config';

function CustomerFormModal({ type, customer, onSave, onClose }) {
  const isSender = type === 'sender';
  const isEdit = !!customer;
  const [form, setForm] = useState({
    fullName: customer?.fullName || '',
    phone: customer?.phone || '',
    notes: customer?.notes || '',
    apartment: customer?.address?.apartment || '',
    floor: customer?.address?.floor || '',
  });
  const [address, setAddress] = useState(customer?.address || null);
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const lookupTimeoutRef = useRef(null);
  const handlePhoneChange = (v) => {
    setForm((p) => ({ ...p, phone: v }));
    if (!isEdit && (v || '').replace(/\D/g, '').length >= 7) {
      clearTimeout(lookupTimeoutRef.current);
      lookupTimeoutRef.current = setTimeout(() => {
        const url = isSender
          ? `${API_BASE}/customers/by-phone?phone=${encodeURIComponent(v)}`
          : `${API_BASE}/receivers/by-phone?phone=${encodeURIComponent(v)}`;
        fetch(url)
          .then((r) => r.ok ? r.json() : null)
          .then((u) => {
            if (u) {
              setForm((p) => ({ ...p, fullName: u.fullName || p.fullName, phone: u.phone || p.phone, notes: (u.notes ?? p.notes) }));
              if (u.address) setAddress(u.address);
            }
          })
          .catch(() => {});
      }, 400);
    }
  };

  const handleAddressSelect = (addr) => {
    setAddress({
      displayAddress: addr.displayAddress,
      lat: addr.lat,
      lng: addr.lng,
      city: addr.city || '',
      street: addr.street || '',
      houseNumber: addr.houseNumber || '',
      apartment: form.apartment || '',
      floor: form.floor || '',
    });
    setShowAddressPicker(false);
  };

  const handleSave = async () => {
    if (!form.fullName.trim()) {
      setError('Full name is required');
      return;
    }
    if (!form.phone.trim()) {
      setError('Phone is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        ...(isSender ? { notes: form.notes.trim() } : {}),
        address: address ? {
          ...address,
          apartment: form.apartment || '',
          floor: form.floor || '',
        } : null,
      };
      const base = isSender ? 'users' : 'receivers';
      const url = isEdit ? `${API_BASE}/${base}/${customer.id}` : `${API_BASE}/${base}`;
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
      <div className="modal-content max-w-md max-h-[90vh] animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-bold text-slate-800 text-lg">
            {isEdit ? 'Edit' : 'Add'} {isSender ? 'Sender' : 'Receiver'}
          </h3>
          <button onClick={onClose} className="action-btn hover:bg-slate-100 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="modal-body space-y-4">
          <div>
            <label className="label">Full name *</label>
            <input
              name="fullName"
              value={form.fullName}
              onChange={handleChange}
              placeholder="Full name"
              className="input-field"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="label">Phone *</label>
            <PhoneInput
              value={form.phone}
              onChange={handlePhoneChange}
              placeholder="501234567"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="label">Address</label>
            {address ? (
              <div className="flex items-start gap-3 p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl">
                <MapPin className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{address.displayAddress}</p>
                  {address.lat != null && (
                    <p className="text-xs font-mono text-slate-400">
                      {Number(address.lat).toFixed(5)}, {Number(address.lng).toFixed(5)}
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setShowAddressPicker(true)}
                    className="action-btn text-indigo-600 hover:bg-indigo-100"
                    title="Change address"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddress(null)}
                    className="action-btn text-slate-400 hover:text-red-500 hover:bg-red-50"
                    title="Clear address"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddressPicker(true)}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed border-slate-300 rounded-xl text-sm text-slate-600 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
              >
                <MapPin className="w-4 h-4" />
                Pick address on map
              </button>
            )}
            {address && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="label">Apartment</label>
                  <input
                    name="apartment"
                    value={form.apartment}
                    onChange={handleChange}
                    placeholder="3"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label">Floor</label>
                  <input
                    name="floor"
                    value={form.floor}
                    onChange={handleChange}
                    placeholder="2"
                    className="input-field"
                  />
                </div>
              </div>
            )}
          </div>
          {isSender && (
            <div>
              <label className="label">Notes</label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                placeholder="Optional notes..."
                rows={2}
                className="input-field resize-none"
              />
            </div>
          )}
          {error && (
            <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">{error}</p>
          )}
        </div>
        <div className="modal-footer">
          <button
            onClick={onClose}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex-1"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : isEdit ? 'Save changes' : `Add ${isSender ? 'sender' : 'receiver'}`}
          </button>
        </div>
      </div>

      {showAddressPicker && (
        <AddressPicker
          isOpen
          onClose={() => setShowAddressPicker(false)}
          onSelect={handleAddressSelect}
          initialPosition={address?.lat != null ? [address.lat, address.lng] : undefined}
        />
      )}
    </div>
  );
}

export default function CustomersPanel() {
  const [activeTab, setActiveTab] = useState('senders');
  const [senders, setSenders] = useState([]);
  const [receivers, setReceivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const isSenders = activeTab === 'senders';
  const items = isSenders ? senders : receivers;
  const setItems = isSenders ? setSenders : setReceivers;
  const base = isSenders ? 'users' : 'receivers';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const q = search.trim();
      const [sendersRes, receiversRes] = await Promise.all([
        fetch(q ? `${API_BASE}/users?q=${encodeURIComponent(q)}` : `${API_BASE}/users`),
        fetch(q ? `${API_BASE}/receivers?q=${encodeURIComponent(q)}` : `${API_BASE}/receivers`),
      ]);
      setSenders(sendersRes.ok ? await sendersRes.json() : []);
      setReceivers(receiversRes.ok ? await receiversRes.json() : []);
    } catch {
      setSenders([]);
      setReceivers([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => fetchData(), search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchData, search]);

  const handleDelete = async (id) => {
    if (!window.confirm(`Delete this ${isSenders ? 'sender' : 'receiver'}?`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${API_BASE}/${base}/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Delete failed');
        return;
      }
      setItems((prev) => prev.filter((c) => c.id !== id));
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaved = () => {
    fetchData();
    setEditingItem(null);
    setShowAdd(false);
  };

  return (
    <section className="card animate-fade-in">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <h2 className="section-title">
          <UserCircle2 className="w-5 h-5 text-indigo-500" />
          Customers
        </h2>
        <button
          onClick={() => setShowAdd(true)}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" />
          Add {isSenders ? 'sender' : 'receiver'}
        </button>
      </div>

      <div className="flex gap-2 px-6 py-3 border-b border-slate-100 bg-slate-50/30">
        <button
          onClick={() => setActiveTab('senders')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
            activeTab === 'senders'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
          }`}
        >
          <Send className="w-4 h-4" />
          Senders ({senders.length})
        </button>
        <button
          onClick={() => setActiveTab('receivers')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
            activeTab === 'receivers'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
          }`}
        >
          <Package className="w-4 h-4" />
          Receivers ({receivers.length})
        </button>
      </div>

      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/30">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or phone…"
            className="input-field pl-10"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="p-12 text-center text-slate-500">Loading…</p>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <UserCircle2 className="w-8 h-8 text-slate-300" />
          </div>
          <p className="text-base font-medium text-slate-500">
            {search ? `No ${isSenders ? 'senders' : 'receivers'} match your search` : `No ${isSenders ? 'senders' : 'receivers'} yet`}
          </p>
          {!search && <p className="text-sm text-slate-400 mt-1">Add one to get started.</p>}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-center">
            <thead>
              <tr className="table-header">
                <th className="text-left">Name</th>
                <th className="text-left">Phone</th>
                <th className="text-left">Address</th>
                {isSenders && <th className="text-left">Notes</th>}
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="table-row">
                  <td className="text-left">
                    <p className="font-medium text-slate-800 text-sm">{c.fullName || '—'}</p>
                    {isSenders && c.notes && (
                      <p className="text-xs text-slate-400 truncate max-w-[200px]" title={c.notes}>{c.notes}</p>
                    )}
                  </td>
                  <td className="text-left">
                    <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {c.phone || '—'}
                    </span>
                  </td>
                  <td className="text-left max-w-[220px]">
                    {c.address?.displayAddress ? (
                      <span className="inline-flex items-center gap-1 text-sm text-slate-600 truncate">
                        <MapPin className="w-3.5 h-3.5 text-green-500 shrink-0" />
                        {c.address.displayAddress}
                      </span>
                    ) : (
                      <span className="text-slate-300 text-sm">—</span>
                    )}
                  </td>
                  {isSenders && (
                    <td className="text-left max-w-[160px]">
                      <span className="text-xs text-slate-500 truncate block" title={c.notes}>{c.notes || '—'}</span>
                    </td>
                  )}
                  <td className="text-xs text-slate-400 whitespace-nowrap">
                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-GB') : '—'}
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        onClick={() => setEditingItem(c)}
                        className="action-btn hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        disabled={deletingId === c.id}
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

      {showAdd && <CustomerFormModal type={activeTab === 'senders' ? 'sender' : 'receiver'} onSave={handleSaved} onClose={() => setShowAdd(false)} />}
      {editingItem && (
        <CustomerFormModal
          type={activeTab === 'senders' ? 'sender' : 'receiver'}
          customer={editingItem}
          onSave={handleSaved}
          onClose={() => setEditingItem(null)}
        />
      )}
    </section>
  );
}
