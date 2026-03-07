import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  Copy,
  Link2,
  Tag,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  PhoneCall,
  PhoneOff,
  Package,
} from 'lucide-react';
import { API_BASE } from '../config';

const SITE_URL = import.meta.env.VITE_SITE_URL || 'https://isa-express.vercel.app';

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).catch(() => {});
}

function AffiliateFormModal({ affiliate, onSave, onClose }) {
  const isEdit = !!affiliate;
  const [form, setForm] = useState({
    name: affiliate?.name || '',
    slug: affiliate?.slug || '',
    promoCode: affiliate?.promoCode || '',
    discountAmount: affiliate?.discountAmount ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const autoSlug = (name) =>
    name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

  const handleNameBlur = () => {
    if (!form.slug && form.name) {
      setForm((p) => ({ ...p, slug: autoSlug(p.name) }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
      if (!form.name.trim() || !form.slug.trim() || !form.promoCode.trim() || form.discountAmount === '') {
      setError('All fields are required');
      return;
    }
    setSaving(true);
    try {
      const url = isEdit ? `${API_BASE}/affiliates/${affiliate.id}` : `${API_BASE}/affiliates`;
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, discountAmount: Number(form.discountAmount) }),
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
            {isEdit ? 'Edit affiliate' : 'New affiliate'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Affiliate name *</label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              onBlur={handleNameBlur}
              placeholder="John Smith"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Slug (for URL) *
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 shrink-0">?ref=</span>
              <input
                name="slug"
                value={form.slug}
                onChange={handleChange}
                placeholder="yosi-cohen"
                className="flex-1 px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                required
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Link: {SITE_URL}/?ref={form.slug || 'slug'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Promo code *</label>
            <input
              name="promoCode"
              value={form.promoCode}
              onChange={(e) => setForm((p) => ({ ...p, promoCode: e.target.value.toUpperCase() }))}
              placeholder="YOSI35"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-indigo-300"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Discount amount (₪) *
            </label>
            <input
              name="discountAmount"
              type="number"
              min="1"
              value={form.discountAmount}
              onChange={handleChange}
              placeholder="35"
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
              {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create affiliate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const TYPE_LABELS = { pickup: 'Pick up', empty_box: 'Box' };
const getTypeLabel = (type) => TYPE_LABELS[type] || (type === 'send' ? 'Pick up' : type);

function AffiliateOrdersTable({ orders }) {
  if (orders.length === 0) {
    return (
      <div className="px-6 py-4 text-sm text-slate-400 text-center">
        No orders for this affiliate yet
      </div>
    );
  }
  return (
    <div className="overflow-x-auto border-t border-slate-100">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="bg-slate-100 text-xs font-semibold text-slate-500 uppercase">
            <th className="px-4 py-2">ID</th>
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Phone</th>
            <th className="px-4 py-2">Type</th>
            <th className="px-4 py-2">Discount</th>
            <th className="px-4 py-2">Contacted</th>
            <th className="px-4 py-2">Date</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-t border-slate-100 hover:bg-slate-50/60">
              <td className="px-4 py-2 font-mono font-bold text-blue-600">{order.id}</td>
              <td className="px-4 py-2 text-slate-700">
                {order.fullName || [order.firstName, order.lastName].filter(Boolean).join(' ') || '—'}
              </td>
              <td className="px-4 py-2 text-slate-600">{order.customerPhone || '—'}</td>
              <td className="px-4 py-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100">
                  {getTypeLabel(order.type)}
                </span>
              </td>
              <td className="px-4 py-2">
                {order.discountAmount ? (
                  <span className="flex items-center gap-1 text-emerald-600 font-semibold text-xs">
                    <Tag className="w-3 h-3" />₪{order.discountAmount}
                  </span>
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </td>
              <td className="px-4 py-2">
                {order.contacted ? (
                  <span className="flex items-center gap-1 text-green-600 text-xs">
                    <PhoneCall className="w-3 h-3" /> Yes
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-600 text-xs">
                    <PhoneOff className="w-3 h-3" /> No
                  </span>
                )}
              </td>
              <td className="px-4 py-2 text-slate-500 text-xs">
                {order.createdAt
                  ? new Date(order.createdAt).toLocaleDateString('en-US', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AffiliatesPanel({ missions = [] }) {
  const [affiliates, setAffiliates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingAffiliate, setEditingAffiliate] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const fetchAffiliates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/affiliates`);
      if (!res.ok) throw new Error('Failed to fetch');
      setAffiliates(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAffiliates(); }, [fetchAffiliates]);

  const handleCopy = (text, id) => {
    copyToClipboard(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this affiliate?')) return;
    setDeletingId(id);
    try {
      await fetch(`${API_BASE}/affiliates/${id}`, { method: 'DELETE' });
      setAffiliates((prev) => prev.filter((a) => a.id !== id));
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleActive = async (affiliate) => {
    try {
      const res = await fetch(`${API_BASE}/affiliates/${affiliate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !affiliate.active }),
      });
      const updated = await res.json();
      setAffiliates((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } catch {}
  };

  const handleSave = (saved) => {
    setAffiliates((prev) => {
      const idx = prev.findIndex((a) => a.id === saved.id);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [...prev, saved];
    });
    setShowForm(false);
    setEditingAffiliate(null);
  };

  const totalOrders = missions.filter((m) => m.affiliateName).length;

  return (
    <div className="space-y-6">
      {/* Header stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="text-2xl font-bold text-slate-800">{affiliates.length}</div>
          <div className="text-sm text-slate-500">Total affiliates</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="text-2xl font-bold text-green-600">
            {affiliates.filter((a) => a.active !== false).length}
          </div>
          <div className="text-sm text-slate-500">Active</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="text-2xl font-bold text-indigo-600">{totalOrders}</div>
          <div className="text-sm text-slate-500">Affiliate orders</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Affiliate Management
          </h2>
          <button
            onClick={() => { setEditingAffiliate(null); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            New affiliate
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-600">{error}</div>
        ) : affiliates.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>No affiliates yet</p>
            <p className="text-sm mt-1">Click &quot;New affiliate&quot; to add one</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Link (Slug)</th>
                  <th className="px-4 py-3">Promo Code</th>
                  <th className="px-4 py-3">Discount</th>
                  <th className="px-4 py-3">Orders</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {affiliates.map((affiliate) => {
                  const trackingLink = `${SITE_URL}/?ref=${affiliate.slug}`;
                  const affiliateOrders = missions.filter(
                    (m) => m.affiliateName === affiliate.name,
                  );
                  const isExpanded = expandedId === affiliate.id;
                  return (
                    <>
                      <tr
                        key={affiliate.id}
                        className={`border-b border-slate-100 hover:bg-slate-50/50 cursor-pointer ${
                          affiliate.active === false ? 'opacity-50' : ''
                        }`}
                        onClick={() => setExpandedId(isExpanded ? null : affiliate.id)}
                      >
                        <td className="px-4 py-3 font-semibold text-slate-800">{affiliate.name}</td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            <a
                              href={trackingLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 font-mono bg-blue-50 px-2 py-0.5 rounded truncate max-w-[140px] hover:underline hover:bg-blue-100"
                              title={trackingLink}
                            >
                              ?ref={affiliate.slug}
                            </a>
                            <button
                              onClick={() => handleCopy(trackingLink, `link-${affiliate.id}`)}
                              className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"
                              title="Copy link"
                            >
                              {copiedId === `link-${affiliate.id}` ? (
                                <Check className="w-3.5 h-3.5 text-green-500" />
                              ) : (
                                <Link2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200">
                              {affiliate.promoCode}
                            </span>
                            <button
                              onClick={() => handleCopy(affiliate.promoCode, `code-${affiliate.id}`)}
                              className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"
                              title="Copy code"
                            >
                              {copiedId === `code-${affiliate.id}` ? (
                                <Check className="w-3.5 h-3.5 text-green-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1 text-sm font-bold text-emerald-600">
                            <Tag className="w-3.5 h-3.5" />
                            ₪{affiliate.discountAmount}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            className="flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
                            onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : affiliate.id); }}
                          >
                            <Package className="w-3.5 h-3.5" />
                            {affiliateOrders.length}
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleToggleActive(affiliate)}
                            className="flex items-center gap-1 text-xs font-medium"
                            title={affiliate.active === false ? 'Enable' : 'Disable'}
                          >
                            {affiliate.active === false ? (
                              <>
                                <ToggleLeft className="w-5 h-5 text-slate-400" />
                                <span className="text-slate-400">Off</span>
                              </>
                            ) : (
                              <>
                                <ToggleRight className="w-5 h-5 text-green-500" />
                                <span className="text-green-600">Active</span>
                              </>
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => { setEditingAffiliate(affiliate); setShowForm(true); }}
                              className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(affiliate.id)}
                              disabled={deletingId === affiliate.id}
                              className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-600"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${affiliate.id}-orders`} className="bg-indigo-50/40">
                          <td colSpan={7} className="px-0 py-0">
                            <div className="border-t border-indigo-100">
                              <div className="px-4 py-2 text-xs font-semibold text-indigo-700 flex items-center gap-2 bg-indigo-50">
                                <Package className="w-3.5 h-3.5" />
                                Orders via {affiliate.name} ({affiliateOrders.length})
                              </div>
                              <AffiliateOrdersTable orders={affiliateOrders} />
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <AffiliateFormModal
          affiliate={editingAffiliate}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingAffiliate(null); }}
        />
      )}
    </div>
  );
}
