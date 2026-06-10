import { useState, useEffect, useCallback, useRef } from 'react';
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
  Search,
  Download,
  FileUp,
  QrCode,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import QRCode from 'qrcode';
import * as XLSX from 'xlsx';
import { API_BASE } from '../config';
import { isAffiliatePickupCompletedInLionWheel } from '../lionwheelStatus';

const CUSTOMER_SITE_URL = import.meta.env.VITE_CUSTOMER_SITE_URL || import.meta.env.VITE_SITE_URL || 'https://www.isa-express.com';

function getAffiliateOrderUrl(slug) {
  return `${CUSTOMER_SITE_URL}/order?ref=${slug}`;
}

async function downloadAffiliateQr(slug) {
  const url = getAffiliateOrderUrl(slug);
  try {
    const dataUrl = await QRCode.toDataURL(url, { width: 512, margin: 2, errorCorrectionLevel: 'M' });
    const link = document.createElement('a');
    link.download = `${slug}.png`;
    link.href = dataUrl;
    link.click();
  } catch {
    /* ignore */
  }
}

function AffiliateQrBlock({ slug, size = 128, showLabel = true, showDownload = true }) {
  const url = getAffiliateOrderUrl(slug);

  if (!slug) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
        <QRCodeSVG
          id={`affiliate-qr-${slug}`}
          value={url}
          size={size}
          level="M"
          includeMargin
        />
      </div>
      {showLabel && (
        <p className="text-[10px] text-slate-400 font-mono text-center max-w-[160px] break-all">{url}</p>
      )}
      {showDownload && (
        <button
          type="button"
          onClick={() => downloadAffiliateQr(slug)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
        >
          <Download className="w-3.5 h-3.5" />
          Download QR ({slug}.png)
        </button>
      )}
    </div>
  );
}

function AffiliateQrModal({ affiliate, onClose }) {
  if (!affiliate) return null;
  return (
    <div className="modal-overlay z-[60]" onClick={onClose}>
      <div className="modal-content max-w-sm animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="font-bold text-slate-800 text-lg">QR Code — {affiliate.name}</h2>
          <button onClick={onClose} className="action-btn hover:bg-slate-100 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="modal-body flex flex-col items-center gap-4 py-2">
          <p className="text-sm text-slate-500 text-center">
            Scan to open the customer order page with the discount applied automatically.
          </p>
          <AffiliateQrBlock slug={affiliate.slug} size={200} showDownload={false} />
        </div>
        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Close
          </button>
          <button
            type="button"
            onClick={() => downloadAffiliateQr(affiliate.slug)}
            className="btn-primary flex-1 inline-flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download {affiliate.slug}.png
          </button>
        </div>
      </div>
    </div>
  );
}

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
    commissionPerOrder: affiliate?.commissionPerOrder ?? '',
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
      if (!form.name.trim() || !form.slug.trim() || !form.promoCode.trim() || form.discountAmount === '' || form.commissionPerOrder === '') {
      setError('All fields are required');
      return;
    }
    setSaving(true);
    try {
      const url = isEdit ? `${API_BASE}/affiliates/${affiliate.id}` : `${API_BASE}/affiliates`;
      const method = isEdit ? 'PATCH' : 'POST';
      const payload = {
        ...form,
        discountAmount: Number(form.discountAmount),
        commissionPerOrder: form.commissionPerOrder !== '' ? Number(form.commissionPerOrder) : null,
      };
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
            {isEdit ? 'Edit affiliate' : 'New affiliate'}
          </h2>
          <button onClick={onClose} className="action-btn hover:bg-slate-100 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body space-y-4">
          <div>
            <label className="label">Affiliate name *</label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              onBlur={handleNameBlur}
              placeholder="John Smith"
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="label">
              Slug (for URL) *
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 shrink-0 font-mono">?ref=</span>
              <input
                name="slug"
                value={form.slug}
                onChange={handleChange}
                placeholder="yosi-cohen"
                className="input-field flex-1"
                required
              />
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              Link: {getAffiliateOrderUrl(form.slug || 'slug')}
            </p>
            {form.slug && (
              <div className="mt-3 flex items-start gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <AffiliateQrBlock slug={form.slug} size={96} showLabel={false} />
                <div className="text-xs text-slate-500 space-y-2 pt-1">
                  <p className="font-semibold text-slate-700">QR preview</p>
                  <p>Scanning opens the customer order page with this affiliate&apos;s discount applied.</p>
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="label">Promo code *</label>
            <input
              name="promoCode"
              value={form.promoCode}
              onChange={(e) => setForm((p) => ({ ...p, promoCode: e.target.value.toUpperCase() }))}
              placeholder="YOSI35"
              className="input-field font-mono uppercase"
              required
            />
          </div>
          <div>
            <label className="label">
              Discount amount (₪) *
            </label>
            <input
              name="discountAmount"
              type="number"
              min="1"
              value={form.discountAmount}
              onChange={handleChange}
              placeholder="35"
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="label">Commission per order (₪) *</label>
            <input
              name="commissionPerOrder"
              type="number"
              min="0"
              value={form.commissionPerOrder}
              onChange={handleChange}
              placeholder="20"
              className="input-field"
              required
            />
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
            {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create affiliate'}
          </button>
        </div>
      </div>
    </div>
  );
}

const TYPE_LABELS = { pickup: 'Pick up', empty_box: 'Box' };
const getTypeLabel = (type) => TYPE_LABELS[type] || (type === 'send' ? 'Pick up' : type);

function getCustomerKey(order) {
  return order.customerPhone || order.fullName || [order.firstName, order.lastName].filter(Boolean).join(' ') || 'unknown';
}

function getCustomerName(order) {
  return order.fullName || [order.firstName, order.lastName].filter(Boolean).join(' ') || '—';
}

function CustomerOrdersTable({ orders }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-center text-sm table-fixed">
        <thead>
          <tr className="table-header">
            <th>ID</th>
            <th>Type</th>
            <th>Discount</th>
            <th>Contacted</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="table-row">
              <td><span className="table-id">{order.id}</span></td>
              <td>
                <span className="badge-pill bg-slate-100 text-slate-600">
                  {getTypeLabel(order.type)}
                </span>
              </td>
              <td>
                {order.discountAmount ? (
                  <span className="inline-flex items-center justify-center gap-1 text-emerald-600 font-semibold text-xs">
                    <Tag className="w-3 h-3" />₪{order.discountAmount}
                  </span>
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </td>
              <td>
                {order.contacted ? (
                  <span className="inline-flex items-center justify-center gap-1 text-green-600 text-xs">
                    <PhoneCall className="w-3 h-3" /> Yes
                  </span>
                ) : (
                  <span className="inline-flex items-center justify-center gap-1 text-amber-600 text-xs">
                    <PhoneOff className="w-3 h-3" /> No
                  </span>
                )}
              </td>
              <td className="text-slate-500 text-xs">
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

function exportCustomersToExcel(affiliateName, orders, importedCustomers = []) {
  const customerMap = {};
  orders.forEach((order) => {
    const key = getCustomerKey(order);
    if (!customerMap[key]) {
      const fullName = getCustomerName(order);
      const parts = fullName.split(' ');
      customerMap[key] = {
        'שם פרטי': order.firstName || parts[0] || '',
        'שם משפחה': order.lastName || parts.slice(1).join(' ') || '',
        'מספר טלפון': order.customerPhone || '',
      };
    }
  });

  importedCustomers.forEach((c) => {
    const phone = (String(c.phone || '')).replace(/\D/g, '');
    const key = phone || `${c.firstName}-${c.lastName}`;
    if (!customerMap[key]) {
      customerMap[key] = {
        'שם פרטי': c.firstName || '',
        'שם משפחה': c.lastName || '',
        'מספר טלפון': c.phone || '',
      };
    }
  });

  const rows = Object.values(customerMap);
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 18 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Customers');
  XLSX.writeFile(wb, `customers-${affiliateName}.xlsx`);
}

function AffiliateCustomersTable({ orders, importedCustomers = [] }) {
  const [expandedCustomer, setExpandedCustomer] = useState(null);

  const customerMap = {};
  orders.forEach((order) => {
    const key = getCustomerKey(order);
    if (!customerMap[key]) {
      customerMap[key] = {
        key,
        name: getCustomerName(order),
        phone: order.customerPhone || '—',
        orders: [],
        isImported: false,
      };
    }
    customerMap[key].orders.push(order);
  });

  importedCustomers.forEach((c) => {
    const phone = (String(c.phone || '')).replace(/\D/g, '');
    const key = phone || `${c.firstName}-${c.lastName}`;
    if (!customerMap[key]) {
      customerMap[key] = {
        key,
        name: [c.firstName, c.lastName].filter(Boolean).join(' ') || '—',
        phone: c.phone || '—',
        orders: [],
        isImported: true,
      };
    }
  });

  const customers = Object.values(customerMap);

  if (customers.length === 0) {
    return (
      <div className="px-6 py-8 text-sm text-slate-400 text-center">
        No customers for this affiliate yet
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border-t border-slate-100">
      <table className="w-full text-center text-sm table-fixed">
        <thead>
          <tr className="table-header">
            <th>Name</th>
            <th>Phone</th>
            <th>Orders</th>
            <th>Total Discount</th>
            <th>Last Order</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((customer) => {
            const isExpanded = expandedCustomer === customer.key;
            const totalDiscount = customer.orders.reduce((sum, o) => sum + (o.discountAmount || 0), 0);
            const lastOrder = [...customer.orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
            const hasOrders = customer.orders.length > 0;
            return (
              <>
                <tr
                  key={customer.key}
                  className={`table-row ${hasOrders ? 'cursor-pointer' : ''}`}
                  onClick={() => hasOrders && setExpandedCustomer(isExpanded ? null : customer.key)}
                >
                  <td className="font-semibold text-slate-700">
                    <span className="flex items-center justify-center gap-2">
                      {customer.name}
                      {customer.isImported && (
                        <span className="text-[10px] font-semibold bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-md border border-violet-200">
                          Imported
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="text-slate-600">{customer.phone}</td>
                  <td>
                    {hasOrders ? (
                      <button className="inline-flex items-center justify-center gap-1 text-indigo-600 font-semibold text-sm">
                        <Package className="w-3.5 h-3.5" />
                        {customer.orders.length}
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    ) : (
                      <span className="text-slate-300 text-sm">0</span>
                    )}
                  </td>
                  <td>
                    {totalDiscount > 0 ? (
                      <span className="inline-flex items-center justify-center gap-1 text-emerald-600 font-semibold text-xs">
                        <Tag className="w-3 h-3" />₪{totalDiscount}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="text-slate-500 text-xs">
                    {lastOrder?.createdAt
                      ? new Date(lastOrder.createdAt).toLocaleDateString('en-US', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                        })
                      : '—'}
                  </td>
                </tr>
                {isExpanded && hasOrders && (
                  <tr key={`${customer.key}-orders`} className="bg-slate-50/60">
                    <td colSpan={5} className="px-0 py-0">
                      <div className="border-t border-slate-200">
                        <div className="px-6 py-2 text-xs font-semibold text-slate-500 flex items-center gap-2 bg-slate-100/60">
                          <Package className="w-3.5 h-3.5" />
                          Orders by {customer.name} ({customer.orders.length})
                        </div>
                        <CustomerOrdersTable orders={customer.orders} />
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
  const [search, setSearch] = useState('');
  const [importingId, setImportingId] = useState(null);
  const [importError, setImportError] = useState(null);
  const [qrAffiliate, setQrAffiliate] = useState(null);
  const fileInputRef = useRef(null);

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

  const handleImportClick = (affiliateId) => {
    setImportError(null);
    setImportingId(affiliateId);
    fileInputRef.current.value = '';
    fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !importingId) { setImportingId(null); return; }
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      const customers = rows
        .map((row) => ({
          firstName: String(row['שם פרטי'] || row['firstName'] || row['first_name'] || '').trim(),
          lastName:  String(row['שם משפחה'] || row['lastName']  || row['last_name']  || '').trim(),
          phone:     String(row['מספר טלפון'] || row['phone'] || row['טלפון'] || '').trim(),
        }))
        .filter((c) => c.phone);

      if (customers.length === 0) {
        setImportError('No valid rows found. Make sure the file has columns: שם פרטי, שם משפחה, מספר טלפון');
        setImportingId(null);
        return;
      }

      const res = await fetch(`${API_BASE}/affiliates/${importingId}/customers/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customers }),
      });
      const updated = await res.json();
      if (!res.ok) throw new Error(updated.error || 'Import failed');
      setAffiliates((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } catch (err) {
      setImportError(err.message);
    } finally {
      setImportingId(null);
    }
  };

  const totalOrders = missions.filter(isAffiliatePickupCompletedInLionWheel).length;

  const filteredAffiliates = affiliates.filter((a) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (a.name      || '').toLowerCase().includes(q) ||
      (a.slug      || '').toLowerCase().includes(q) ||
      (a.promoCode || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="stat-card border-l-4 border-indigo-500">
          <div className="text-3xl font-extrabold text-slate-800">{affiliates.length}</div>
          <div className="text-sm text-slate-500 mt-1">Total affiliates</div>
        </div>
        <div className="stat-card border-l-4 border-emerald-500">
          <div className="text-3xl font-extrabold text-emerald-600">
            {affiliates.filter((a) => a.active !== false).length}
          </div>
          <div className="text-sm text-slate-500 mt-1">Active</div>
        </div>
        <div className="stat-card border-l-4 border-violet-500">
          <div className="text-3xl font-extrabold text-violet-600">{totalOrders}</div>
          <div className="text-sm text-slate-500 mt-1">Affiliate orders</div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="section-title">
            <Users className="w-5 h-5 text-indigo-500" />
            Affiliate Management ({search ? `${filteredAffiliates.length} / ${affiliates.length}` : affiliates.length})
          </h2>
          <button
            onClick={() => { setEditingAffiliate(null); setShowForm(true); }}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" />
            New affiliate
          </button>
        </div>
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/30">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, slug or promo code…"
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
          <div className="p-12 text-center text-slate-500">Loading...</div>
        ) : error ? (
          <div className="p-12 text-center text-red-600">{error}</div>
        ) : affiliates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-base font-medium text-slate-500">No affiliates yet</p>
            <p className="text-sm text-slate-400 mt-1">Click &quot;New affiliate&quot; to add one</p>
          </div>
        ) : filteredAffiliates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-base font-medium text-slate-500">No affiliates match your search</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-center table-fixed">
              <thead>
                <tr className="table-header">
                  <th>Name</th>
                  <th>Link (Slug)</th>
                  <th>Promo Code</th>
                  <th>Discount</th>
                  <th>Commission/Order</th>
                  <th>Customers</th>
                  <th>Total Earnings</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAffiliates.map((affiliate) => {
                  const trackingLink = getAffiliateOrderUrl(affiliate.slug);
                  const affiliateOrders = missions.filter(
                    (m) => m.affiliateName === affiliate.name && isAffiliatePickupCompletedInLionWheel(m),
                  );
                  const missionKeys = new Set(affiliateOrders.map(getCustomerKey));
                  const importedKeys = new Set(
                    (affiliate.importedCustomers || []).map((c) => {
                      const phone = (String(c.phone || '')).replace(/\D/g, '');
                      return phone || `${c.firstName}-${c.lastName}`;
                    })
                  );
                  const uniqueCustomers = new Set([...missionKeys, ...importedKeys]).size;
                  const isExpanded = expandedId === affiliate.id;
                  return (
                    <>
                      <tr
                        key={affiliate.id}
                        className={`table-row cursor-pointer ${
                          affiliate.active === false ? 'row-inactive' : ''
                        }`}
                        onClick={() => setExpandedId(isExpanded ? null : affiliate.id)}
                      >
                        <td className="font-semibold text-slate-800">{affiliate.name}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-2">
                            <a
                              href={trackingLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 font-mono bg-blue-50 px-2.5 py-1 rounded-lg truncate max-w-[140px] hover:underline hover:bg-blue-100 transition-colors"
                              title={trackingLink}
                            >
                              ?ref={affiliate.slug}
                            </a>
                            <button
                              onClick={() => handleCopy(trackingLink, `link-${affiliate.id}`)}
                              className="action-btn hover:bg-slate-100 text-slate-400 hover:text-slate-600"
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
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-xs font-mono font-bold bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg border border-amber-200">
                              {affiliate.promoCode}
                            </span>
                            <button
                              onClick={() => handleCopy(affiliate.promoCode, `code-${affiliate.id}`)}
                              className="action-btn hover:bg-slate-100 text-slate-400 hover:text-slate-600"
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
                        <td>
                          <span className="inline-flex items-center justify-center gap-1 text-sm font-bold text-emerald-600">
                            <Tag className="w-3.5 h-3.5" />
                            ₪{affiliate.discountAmount}
                          </span>
                        </td>
                        <td>
                          {affiliate.commissionPerOrder != null ? (
                            <span className="inline-flex items-center justify-center gap-1 text-sm font-semibold text-violet-600">
                              ₪{affiliate.commissionPerOrder}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td>
                          <button
                            className="inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
                            onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : affiliate.id); }}
                          >
                            <Users className="w-3.5 h-3.5" />
                            {uniqueCustomers}
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>
                        <td>
                          {affiliate.commissionPerOrder != null ? (
                            <span className="inline-flex items-center justify-center gap-1 text-sm font-bold text-violet-700">
                              ₪{(affiliate.commissionPerOrder * affiliateOrders.length).toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleToggleActive(affiliate)}
                            className="inline-flex items-center justify-center gap-1 text-xs font-medium"
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
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="table-actions">
                            <button
                              onClick={() => setQrAffiliate(affiliate)}
                              className="action-btn hover:bg-indigo-50 text-slate-400 hover:text-indigo-600"
                              title="Show QR code"
                            >
                              <QrCode className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => downloadAffiliateQr(affiliate.slug)}
                              className="action-btn hover:bg-indigo-50 text-slate-400 hover:text-indigo-600"
                              title={`Download ${affiliate.slug}.png`}
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => { setEditingAffiliate(affiliate); setShowForm(true); }}
                              className="action-btn hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(affiliate.id)}
                              disabled={deletingId === affiliate.id}
                              className="action-btn hover:bg-red-50 text-slate-400 hover:text-red-600"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${affiliate.id}-customers`} className="bg-indigo-50/40">
                          <td colSpan={9} className="px-0 py-0">
                            <div className="border-t border-indigo-100">
                              <div className="px-6 py-4 flex flex-col sm:flex-row items-center gap-6 bg-white/60 border-b border-indigo-100">
                                <AffiliateQrBlock slug={affiliate.slug} size={120} />
                                <div className="text-sm text-slate-600 text-center sm:text-left">
                                  <p className="font-semibold text-slate-800 mb-1">Customer QR link</p>
                                  <p className="text-xs text-slate-500 mb-2">Scanning opens the order page with discount code <span className="font-mono font-bold text-amber-700">{affiliate.promoCode}</span> applied automatically.</p>
                                  <button
                                    type="button"
                                    onClick={() => handleCopy(trackingLink, `link-${affiliate.id}`)}
                                    className="text-xs font-mono text-blue-600 hover:underline break-all"
                                  >
                                    {trackingLink}
                                  </button>
                                </div>
                              </div>
                              <div className="px-6 py-3 text-xs font-semibold text-indigo-700 flex items-center justify-between gap-2 bg-indigo-50/80">
                                <span className="flex items-center gap-2">
                                  <Users className="w-3.5 h-3.5" />
                                  Customers via {affiliate.name} ({uniqueCustomers})
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleImportClick(affiliate.id)}
                                    disabled={importingId === affiliate.id}
                                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                                    title="Import customers from Excel"
                                  >
                                    <FileUp className="w-3.5 h-3.5" />
                                    {importingId === affiliate.id ? 'Importing…' : 'Import Excel'}
                                  </button>
                                  {(affiliateOrders.length > 0 || (affiliate.importedCustomers || []).length > 0) && (
                                    <button
                                      onClick={() => exportCustomersToExcel(affiliate.name, affiliateOrders, affiliate.importedCustomers || [])}
                                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg transition-colors"
                                      title="Export customers to Excel"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                      Export
                                    </button>
                                  )}
                                </div>
                              </div>
                              <AffiliateCustomersTable
                                orders={affiliateOrders}
                                importedCustomers={affiliate.importedCustomers || []}
                              />
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

      {qrAffiliate && (
        <AffiliateQrModal affiliate={qrAffiliate} onClose={() => setQrAffiliate(null)} />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleFileChange}
      />

      {importError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-red-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {importError}
          <button onClick={() => setImportError(null)} className="ml-2 hover:opacity-70">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
