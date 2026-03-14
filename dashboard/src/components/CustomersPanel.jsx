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

const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0">
          <h3 className="font-bold text-slate-800">
            {isEdit ? 'Edit' : 'Add'} {isSender ? 'Sender' : 'Receiver'}
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Full name *</label>
            <input
              name="fullName"
              value={form.fullName}
              onChange={handleChange}
              placeholder="Full name"
              className={inputCls}
              autoComplete="off"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Phone *</label>
            <PhoneInput
              value={form.phone}
              onChange={handlePhoneChange}
              placeholder="501234567"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Address</label>
            {address ? (
              <div className="flex items-start gap-3 p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
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
                    className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded-lg"
                    title="Change address"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddress(null)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
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
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">Apartment</label>
                  <input
                    name="apartment"
                    value={form.apartment}
                    onChange={handleChange}
                    placeholder="3"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">Floor</label>
                  <input
                    name="floor"
                    value={form.floor}
                    onChange={handleChange}
                    placeholder="2"
                    className={inputCls}
                  />
                </div>
              </div>
            )}
          </div>
          {isSender && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                placeholder="Optional notes..."
                rows={2}
                className={`${inputCls} resize-none`}
              />
            </div>
          )}
          {error && (
            <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>
        <div className="flex gap-2 px-5 py-4 border-t flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold"
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
    <section className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <UserCircle2 className="w-5 h-5" />
          Customers
        </h2>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add {isSenders ? 'sender' : 'receiver'}
        </button>
      </div>

      <div className="flex border-b border-slate-100">
        <button
          onClick={() => setActiveTab('senders')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors ${
            activeTab === 'senders'
              ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Send className="w-4 h-4" />
          Senders ({search ? senders.length : senders.length})
        </button>
        <button
          onClick={() => setActiveTab('receivers')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors ${
            activeTab === 'receivers'
              ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Package className="w-4 h-4" />
          Receivers ({search ? receivers.length : receivers.length})
        </button>
      </div>

      <div className="px-5 py-3 border-b">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or phone…"
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
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
        <p className="p-8 text-center text-slate-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="p-8 text-center text-slate-400">
          {search ? `No ${isSenders ? 'senders' : 'receivers'} match your search` : `No ${isSenders ? 'senders' : 'receivers'} yet. Add one to get started.`}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-center">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Name</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Phone</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Address</th>
                {isSenders && <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Notes</th>}
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3 text-left">
                    <p className="font-medium text-slate-800 text-sm">{c.fullName || '—'}</p>
                    {isSenders && c.notes && (
                      <p className="text-xs text-slate-400 truncate max-w-[200px]" title={c.notes}>{c.notes}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-left">
                    <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {c.phone || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-left max-w-[220px]">
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
                    <td className="px-4 py-3 text-left max-w-[160px]">
                      <span className="text-xs text-slate-500 truncate block" title={c.notes}>{c.notes || '—'}</span>
                    </td>
                  )}
                  <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-GB') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-center">
                      <button
                        onClick={() => setEditingItem(c)}
                        className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        disabled={deletingId === c.id}
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
