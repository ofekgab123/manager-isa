import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Plus,
  Pencil,
  Trash2,
  X,
  AlertTriangle,
  Weight,
  Package,
  AlertCircle,
  Eye,
  MapPin,
  Download,
  FileSpreadsheet,
  FileCheck,
  ImagePlus,
  Video,
  Star,
} from 'lucide-react';
import { API_BASE } from '../config';
import { formatIls, sumBoxContentsIls } from '../parcelContentUtils';
import CollapsibleParcelContent from './CollapsibleParcelContent';

const CAPACITY_ALERT_THRESHOLD = 70;

function containerCountryKey(country) {
  if (country == null || String(country).trim() === '') return '';
  return String(country).trim();
}

function defaultContainerForCountry(containers, country) {
  const key = containerCountryKey(country);
  return containers.find((c) => c.isDefault && containerCountryKey(c.country) === key) ?? null;
}

const CONTAINER_STATUS_LABELS = {
  in_storage_tlv: 'In storage TLV',
  in_transit: 'In transit — estimated arrival in 60 days',
  in_customs_clearance: 'In customs clearance',
  door_to_door_in_progress: 'Door-to-door delivery in progress',
};

function containerStatusBadgeClass(status) {
  const s = status || 'in_storage_tlv';
  if (s === 'in_storage_tlv') return 'bg-slate-100 text-slate-800';
  if (s === 'in_transit') return 'bg-indigo-100 text-indigo-800';
  if (s === 'in_customs_clearance') return 'bg-amber-100 text-amber-800';
  if (s === 'door_to_door_in_progress') return 'bg-emerald-100 text-emerald-800';
  return 'bg-slate-100 text-slate-700';
}

function isoToDatetimeLocal(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function datetimeLocalToIso(local) {
  if (!local || !String(local).trim()) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function formatEstimatedArrival(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

function formatContainerLabel(c) {
  if (!c) return '';
  const name = (c.name || '').trim();
  return name ? `${name} (${c.id})` : c.id;
}

const TYPE_LABELS = { pickup: 'Pickup', empty_box: 'Empty Box' };
const STATUS_LABELS = {
  received: 'Received',
  linewhel_transferred: 'Transferred',
  linewhel_scheduled: 'Scheduled',
  collected: 'Collected',
  shipped: 'Shipped',
  completed: 'Completed',
};

function ContainerPackagesModal({ container, packages, onClose }) {
  if (!container) return null;

  const summary = packages.reduce(
    (acc, m) => {
      const deliveries = m.deliveries ?? [];
      const hasDeliveries = deliveries.length > 0;
      const items = hasDeliveries ? deliveries : [{ boxContents: [], boxWeights: m.pickupBoxWeights ?? [] }];

      items.forEach((d) => {
        const boxContents = d.boxContents ?? [];
        boxContents.forEach((boxItems) => {
          const arr = Array.isArray(boxItems) ? boxItems : [];
          arr.forEach((it) => {
            if (it?.description) {
              acc.byType[it.description] = (acc.byType[it.description] || 0) + (it.qty ?? 1);
            }
            const p = parseFloat(it?.price);
            if (!isNaN(p)) acc.totalPrice += p;
          });
        });

        const weights = d.boxWeights ?? [];
        weights.forEach((w) => {
          const v = parseFloat(w);
          if (!isNaN(v)) acc.totalWeight += v;
        });
      });

      if (hasDeliveries) {
        acc.totalBoxes += deliveries.reduce((s, d) => s + (d.boxCount || 0), 0);
      } else {
        acc.totalBoxes += (m.pickupBoxCount ?? ((m.boxSelection?.large || 0) + (m.boxSelection?.small || 0))) || 0;
      }
      return acc;
    },
    { byType: {}, totalWeight: 0, totalBoxes: 0, totalPrice: 0 }
  );

  const hasSummary = packages.length > 0 && (Object.keys(summary.byType).length > 0 || summary.totalWeight > 0 || summary.totalBoxes > 0 || summary.totalPrice > 0);

  return (
    <div
      className="modal-overlay z-50"
      onClick={onClose}
    >
      <div
        className="modal-content max-w-2xl max-h-[85vh] animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <Package className="w-5 h-5 text-indigo-500" />
            Packages in {container.name || container.id} ({packages.length})
          </h2>
          <button onClick={onClose} className="action-btn hover:bg-slate-100 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="modal-body space-y-4">
          {packages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <Package className="w-7 h-7 text-slate-300" />
              </div>
              <p className="text-slate-500">No packages in this container</p>
            </div>
          ) : (
            <>
              {hasSummary && (
                <div className="p-5 rounded-2xl bg-indigo-600 text-white shadow-lg">
                  <h3 className="font-bold text-sm uppercase tracking-wide mb-3 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Container Summary
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs font-medium text-indigo-200 mb-1">Total boxes</p>
                      <p className="text-xl font-bold">{summary.totalBoxes}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-indigo-200 mb-1">Total weight (kg)</p>
                      <p className="text-xl font-bold">{summary.totalWeight.toFixed(1)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-indigo-200 mb-1">Total price</p>
                      <p className="text-xl font-bold">₪{summary.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                  {Object.keys(summary.byType).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-indigo-500">
                      <p className="text-xs font-medium text-indigo-200 mb-2">Content by type</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(summary.byType)
                          .sort((a, b) => b[1] - a[1])
                          .map(([desc, qty]) => (
                            <span
                              key={desc}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/80 text-sm font-medium"
                            >
                              {desc} × {qty}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-600">Packages</h3>
                {packages.map((m) => {
                  const deliveries = m.deliveries ?? [];
                  const hasDeliveries = deliveries.length > 0;
                  const items = hasDeliveries
                    ? deliveries
                    : [{ boxContents: [], boxWeights: m.pickupBoxWeights ?? [], address: m.receiverAddress, receiverName: m.receiverName }];
                  return (
                    <div
                      key={m.id}
                      className="p-4 rounded-xl border-2 border-slate-200 bg-slate-50/50 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <span className="table-id">{m.id}</span>
                          <p className="text-sm text-slate-700 truncate">{m.fullName || '—'}</p>
                          <p className="text-xs text-slate-500">{m.customerPhone || ''}</p>
                          {m.address?.displayAddress && (
                            <p className="text-xs text-slate-500 flex items-center gap-1 mt-1 truncate">
                              <MapPin className="w-3 h-3 shrink-0" />
                              {m.address.displayAddress}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="badge-pill bg-slate-200 text-slate-700">
                            {TYPE_LABELS[m.type] || m.type}
                          </span>
                          <span className="badge-pill bg-indigo-100 text-indigo-700">
                            {STATUS_LABELS[m.status] || m.status}
                          </span>
                        </div>
                      </div>

                      {items.map((d, di) => {
                        const boxContents = d.boxContents ?? [];
                        const boxWeights = d.boxWeights ?? [];
                        const hasContent = boxContents.some((bc) => Array.isArray(bc) && bc.some((it) => it?.description));
                        const hasWeights = boxWeights.some((w) => w != null && String(w).trim() !== '');
                        const boxCount = Math.max(boxContents.length, boxWeights.length, 1);
                        if (!hasContent && !hasWeights) return null;
                        return (
                          <div key={di} className="pt-2 border-t border-slate-200">
                            {hasDeliveries && (
                              <p className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5">
                                Delivery {di + 1}
                                {d.receiverName && ` — ${d.receiverName}`}
                              </p>
                            )}
                            {d.address?.displayAddress && (
                              <p className="text-xs text-slate-600 flex items-center gap-1 mb-1.5 truncate">
                                <MapPin className="w-3 h-3 shrink-0" />
                                {d.address.displayAddress}
                              </p>
                            )}
                            {hasContent ? (
                              <CollapsibleParcelContent
                                title={(
                                  <span className="text-[10px] font-semibold text-slate-500 uppercase">
                                    Parcel content
                                  </span>
                                )}
                                buttonClassName="flex items-center gap-1.5 w-full text-left rounded-lg hover:bg-slate-50 -mx-0.5 px-0.5 py-0.5 transition-colors mb-1"
                              >
                                <div className="space-y-1.5">
                                  {Array.from({ length: boxCount }, (_, bi) => {
                                    const boxItems = boxContents[bi];
                                    const arr = Array.isArray(boxItems) ? boxItems : [];
                                    const str = arr
                                      .filter((it) => it?.description)
                                      .map((it) => {
                                        const base = `${it.description} ×${it.qty ?? 1}`;
                                        const price = it.price != null && it.price !== '' && Number(it.price) > 0
                                          ? ` ₪${Number(it.price).toLocaleString()}`
                                          : '';
                                        return base + price;
                                      })
                                      .join(', ');
                                    const weight = boxWeights[bi];
                                    const weightStr = weight != null && String(weight).trim() !== '' ? ` · ${weight} kg` : '';
                                    if (!str && !weightStr) return null;
                                    return (
                                      <div key={bi} className="text-xs text-slate-700 flex items-center gap-2">
                                        <span className="font-medium text-slate-500 shrink-0">Box {bi + 1}:</span>
                                        <span>
                                          {str || '—'}
                                          {weightStr}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                                <p className="text-xs font-semibold text-slate-800 mt-1.5 pt-1.5 border-t border-slate-200">
                                  Content total: {formatIls(sumBoxContentsIls(boxContents))}
                                </p>
                              </CollapsibleParcelContent>
                            ) : (
                              <div className="space-y-1.5">
                                {Array.from({ length: boxCount }, (_, bi) => {
                                  const boxItems = boxContents[bi];
                                  const arr = Array.isArray(boxItems) ? boxItems : [];
                                  const str = arr
                                    .filter((it) => it?.description)
                                    .map((it) => {
                                      const base = `${it.description} ×${it.qty ?? 1}`;
                                      const price = it.price != null && it.price !== '' && Number(it.price) > 0
                                        ? ` ₪${Number(it.price).toLocaleString()}`
                                        : '';
                                      return base + price;
                                    })
                                    .join(', ');
                                  const weight = boxWeights[bi];
                                  const weightStr = weight != null && String(weight).trim() !== '' ? ` · ${weight} kg` : '';
                                  if (!str && !weightStr) return null;
                                  return (
                                    <div key={bi} className="text-xs text-slate-700 flex items-center gap-2">
                                      <span className="font-medium text-slate-500 shrink-0">Box {bi + 1}:</span>
                                      <span>
                                        {str || '—'}
                                        {weightStr}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ExportOptionsModal({ onExport, onClose }) {
  const [exportType, setExportType] = useState('courier');

  const handleConfirm = () => {
    onExport(exportType);
    onClose();
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
          <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <Download className="w-5 h-5 text-indigo-500" />
            Export Options
          </h2>
          <button onClick={onClose} className="action-btn hover:bg-slate-100 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="modal-body space-y-6">
          <div>
            <p className="label mb-3">Export type</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setExportType('courier')}
                className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-colors ${
                  exportType === 'courier'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                Export to Courier
              </button>
              <button
                type="button"
                onClick={() => setExportType('customs')}
                className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-colors ${
                  exportType === 'customs'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                Export to Customs
              </button>
            </div>
          </div>
          <p className="text-sm text-slate-500 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 shrink-0 text-green-600" />
            Export downloads as CSV (Excel-compatible).
          </p>
        </div>
        <div className="modal-footer">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="btn-primary flex-1"
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
}

const SUMMARY_STORAGE_KEY = (id) => `container-summary-${id}`;

function ContainerSummaryModal({ container, packages, onClose }) {
  const storageKey = container?.id ? SUMMARY_STORAGE_KEY(container.id) : null;

  const loadSaved = () => {
    if (!storageKey) return null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const saved = loadSaved();
  const [form, setForm] = useState(saved?.form ?? {
    shipperName: '',
    shipperId: '',
    address: '',
    phone: '',
  });
  const [mediaItems, setMediaItems] = useState(() => {
    const items = saved?.mediaItems ?? [];
    return items.map((m) => ({ ...m, file: null }));
  });
  const [expandedMediaIndex, setExpandedMediaIndex] = useState(null);

  const handleChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleMediaAdd = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      const reader = new FileReader();
      reader.onload = () => {
        setMediaItems((prev) => [...prev, { file, preview: reader.result, type, fileName: file.name }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const mediaItemsRef = useRef(mediaItems);
  mediaItemsRef.current = mediaItems;

  const removeMedia = (index) => {
    setMediaItems((prev) => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    if (!storageKey) return;
    try {
      const toSave = {
        form,
        mediaItems: mediaItems.map((m) => ({ type: m.type, preview: m.preview, fileName: m.fileName || m.file?.name })),
      };
      localStorage.setItem(storageKey, JSON.stringify(toSave));
    } catch (err) {
      if (err?.name === 'QuotaExceededError') {
        try {
          localStorage.setItem(storageKey, JSON.stringify({ form, mediaItems: [] }));
        } catch {
        }
      }
    }
  }, [storageKey, form, mediaItems]);

  useEffect(() => () => {
    mediaItemsRef.current.forEach((item) => {
      if (item.type === 'video' && item.preview?.startsWith?.('blob:')) {
        URL.revokeObjectURL(item.preview);
      }
    });
  }, []);

  const isFormValid = form.shipperName.trim() && form.shipperId.trim() && form.address.trim() && form.phone.trim();

  const getContentRows = () => {
    const byDesc = {};
    let totalWeight = 0;
    packages.forEach((m) => {
      const deliveries = m.deliveries ?? [];
      const hasDeliveries = deliveries.length > 0;
      const items = hasDeliveries ? deliveries : [{ boxContents: [], boxWeights: m.pickupBoxWeights ?? [] }];
      items.forEach((d) => {
        const boxContents = d.boxContents ?? [];
        boxContents.forEach((boxItems) => {
          const arr = Array.isArray(boxItems) ? boxItems : [];
          arr.forEach((it) => {
            if (it?.description) {
              const qty = it.qty ?? 1;
              const price = parseFloat(it?.price) || 0;
              const total = qty * price;
              if (!byDesc[it.description]) {
                byDesc[it.description] = { qty: 0, total: 0 };
              }
              byDesc[it.description].qty += qty;
              byDesc[it.description].total += total;
            }
          });
        });
        (d.boxWeights ?? []).forEach((w) => {
          const v = parseFloat(w);
          if (!isNaN(v)) totalWeight += v;
        });
      });
      if (!hasDeliveries && (m.pickupBoxWeights ?? []).length > 0) {
        (m.pickupBoxWeights ?? []).forEach((w) => {
          const v = parseFloat(w);
          if (!isNaN(v)) totalWeight += v;
        });
      }
    });
    const rows = Object.entries(byDesc).map(([desc, { qty, total }]) => ({
      description: desc,
      qty,
      unitPrice: qty > 0 ? total / qty : 0,
      total,
    }));
    const totalQty = rows.reduce((s, r) => s + r.qty, 0);
    const grandTotal = rows.reduce((s, r) => s + r.total, 0);
    const totalPackages = packages.reduce((acc, m) => {
      const deliveries = m.deliveries ?? [];
      if (deliveries.length > 0) {
        return acc + deliveries.reduce((s, d) => s + (d.boxCount || 0), 0);
      }
        const cnt = m.pickupBoxCount ?? ((m.boxSelection?.large || 0) + (m.boxSelection?.small || 0));
        return acc + (cnt || 0);
    }, 0);
    return { rows, totalWeight, totalPackages, totalQty, grandTotal };
  };

  const downloadSummary = () => {
    const { rows, totalWeight, totalPackages, totalQty, grandTotal } = getContentRows();
    const escapeCsv = (val) => {
      const s = String(val ?? '');
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const downloadDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const issueDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const csvLines = [
      `Date: ${downloadDate}`,
      '',
      'GOODS DECLARATION',
      `Issue date: ${issueDate}`,
      `Shipper name: ${form.shipperName}`,
      `ID: ${form.shipperId}`,
      `Address: ${form.address}`,
      `Phone: ${form.phone}`,
      '',
      `Total number of packages: ${totalPackages}`,
      `Total gross weight (kg): ${totalWeight.toFixed(2)}`,
      '',
      ['Description', 'Qty', 'Unit price (NIS)', 'Total (NIS)'].map(escapeCsv).join(','),
    ];
    rows.forEach((r) => {
      csvLines.push(
        [r.description, r.qty, r.unitPrice.toFixed(2), r.total.toFixed(2)].map(escapeCsv).join(',')
      );
    });
    csvLines.push('');
    csvLines.push(['', '', 'Total qty', totalQty].map(escapeCsv).join(','));
    csvLines.push(['', '', 'Grand total (NIS)', grandTotal.toFixed(2)].map(escapeCsv).join(','));
    const csv = '\uFEFF' + csvLines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `goods-declaration-${container.name || container.id}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onClose();
  };

  return (
    <div
      className="modal-overlay z-50"
      onClick={onClose}
    >
      <div
        className="modal-content max-w-2xl max-h-[90vh] animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header sticky top-0 bg-white z-10">
          <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-indigo-500" />
            Container Summary – {container?.name || container?.id}
          </h2>
          <button onClick={onClose} className="action-btn hover:bg-slate-100 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="modal-body space-y-4 overflow-y-auto">
          <div>
            <label className="label">Shipper Name *</label>
            <input
              name="shipperName"
              value={form.shipperName}
              onChange={handleChange}
              placeholder="SHERON FONSEKA"
              className="input-field"
            />
          </div>
          <div>
            <label className="label">ID *</label>
            <input
              name="shipperId"
              value={form.shipperId}
              onChange={handleChange}
              placeholder="Y9572252"
              className="input-field"
            />
          </div>
          <div>
            <label className="label">Address *</label>
            <input
              name="address"
              value={form.address}
              onChange={handleChange}
              placeholder="NELLIAMPATHY, KERALA. COCHIN"
              className="input-field"
            />
          </div>
          <div>
            <label className="label">Phone *</label>
            <input
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
              placeholder="+972..."
              className="input-field"
            />
          </div>
          <div>
            <label className="label">Images & Videos (optional)</label>
            <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/50 text-slate-600 text-sm mb-2 transition-colors">
              <ImagePlus className="w-4 h-4" />
              Add images or videos
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleMediaAdd}
                className="hidden"
              />
            </label>
            {mediaItems.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {mediaItems.map((item, i) => (
                  <div key={i} className="relative group">
                    {item.type === 'image' ? (
                      <img
                        src={item.preview}
                        alt=""
                        className="w-20 h-20 object-cover rounded-xl border border-slate-200 cursor-pointer hover:ring-2 hover:ring-indigo-400 transition-shadow"
                        onClick={() => setExpandedMediaIndex(i)}
                      />
                    ) : (
                      <div
                        className="w-20 h-20 rounded-xl border border-slate-200 bg-slate-100 flex items-center justify-center relative cursor-pointer hover:ring-2 hover:ring-indigo-400 transition-shadow"
                        onClick={() => setExpandedMediaIndex(i)}
                      >
                        <Video className="w-8 h-8 text-slate-500" />
                        <span className="absolute bottom-0 left-0 right-0 text-[10px] truncate px-1 bg-black/60 text-white rounded-b-xl">
                          {item.fileName || item.file?.name || 'video'}
                        </span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeMedia(i); }}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {expandedMediaIndex !== null && mediaItems[expandedMediaIndex] && (
              <div
                className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
                onClick={() => setExpandedMediaIndex(null)}
              >
                <div
                  className="max-w-[90vw] max-h-[90vh] flex items-center justify-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  {mediaItems[expandedMediaIndex].type === 'image' ? (
                    <img
                      src={mediaItems[expandedMediaIndex].preview}
                      alt=""
                      className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <video
                      src={mediaItems[expandedMediaIndex].preview}
                      controls
                      autoPlay
                      className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl"
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setExpandedMediaIndex(null)}
                  className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={downloadSummary}
            disabled={!isFormValid}
            className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Download goods declaration (CSV)
          </button>
        </div>
      </div>
    </div>
  );
}

function ContainerFormModal({ container, onSave, onClose, containers = [] }) {
  const isEdit = !!container;
  const formStorageKey = container?.id ? SUMMARY_STORAGE_KEY(container.id) : 'container-summary-draft';

  const loadShipperSaved = () => {
    try {
      const raw = localStorage.getItem(formStorageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.form ? { form: parsed.form, mediaItems: parsed.mediaItems ?? [] } : null;
    } catch {
      return null;
    }
  };

  const shipperSaved = loadShipperSaved();

  const [form, setForm] = useState({
    name: container?.name || '',
    country: container?.country || '',
    status: container?.status || 'in_storage_tlv',
    estimatedArrivalLocal: isoToDatetimeLocal(container?.estimatedArrivalAt),
    isDefault: Boolean(container?.isDefault),
    maxPackages: container?.maxPackages ?? 220,
    shipperName: shipperSaved?.form?.shipperName ?? '',
    shipperId: shipperSaved?.form?.shipperId ?? '',
    address: shipperSaved?.form?.address ?? '',
    phone: shipperSaved?.form?.phone ?? '',
  });
  const [mediaItems, setMediaItems] = useState(() => {
    const items = shipperSaved?.mediaItems ?? [];
    return items.map((m) => ({ ...m, file: null }));
  });
  const [expandedMediaIndex, setExpandedMediaIndex] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const defaultContainer = defaultContainerForCountry(containers, form.country);
  const thisIsDefault = Boolean(container?.id && defaultContainer?.id === container.id);
  const hasOtherDefault = Boolean(defaultContainer && (!container || defaultContainer.id !== container.id));

  const handleChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleMediaAdd = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      const reader = new FileReader();
      reader.onload = () => {
        setMediaItems((prev) => [...prev, { file, preview: reader.result, type, fileName: file.name }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeMedia = (index) => {
    setMediaItems((prev) => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    try {
      const toSave = {
        form: {
          shipperName: form.shipperName,
          shipperId: form.shipperId,
          address: form.address,
          phone: form.phone,
        },
        mediaItems: mediaItems.map((m) => ({ type: m.type, preview: m.preview, fileName: m.fileName || m.file?.name })),
      };
      localStorage.setItem(formStorageKey, JSON.stringify(toSave));
    } catch (err) {
      if (err?.name === 'QuotaExceededError') {
        try {
          localStorage.setItem(formStorageKey, JSON.stringify({ form: { shipperName: form.shipperName, shipperId: form.shipperId, address: form.address, phone: form.phone }, mediaItems: [] }));
        } catch {
        }
      }
    }
  }, [formStorageKey, form.shipperName, form.shipperId, form.address, form.phone, mediaItems]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const maxPackages = Number(form.maxPackages);
    if (!(maxPackages > 0)) {
      setError('Max packages must be a positive number');
      return;
    }
    setSaving(true);
    try {
      const url = isEdit
        ? `${API_BASE}/containers/${container.id}`
        : `${API_BASE}/containers`;
      const method = isEdit ? 'PATCH' : 'POST';
      const payload = {
        name: form.name.trim() || null,
        country: form.country.trim() || null,
        status: form.status || 'in_storage_tlv',
        estimatedArrivalAt: datetimeLocalToIso(form.estimatedArrivalLocal),
        isDefault: form.isDefault,
        maxPackages,
      };
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save error');
      if (!isEdit && data.id) {
        const newKey = SUMMARY_STORAGE_KEY(data.id);
        const draft = localStorage.getItem(formStorageKey);
        if (draft) {
          localStorage.setItem(newKey, draft);
          localStorage.removeItem(formStorageKey);
        }
      }
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
        className="modal-content max-w-2xl max-h-[90vh] animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header sticky top-0 bg-white z-10">
          <h2 className="font-bold text-slate-800 text-lg">
            {isEdit ? 'Edit container' : 'New container'}
          </h2>
          <button onClick={onClose} className="action-btn hover:bg-slate-100 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body space-y-4 overflow-y-auto">
          <div>
            <label className="label">
              Name (optional)
            </label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Container 1"
              className="input-field"
            />
          </div>
          <div>
            <label className="label">
              Country (optional)
            </label>
            <select
              name="country"
              value={form.country}
              onChange={(e) => {
                const next = e.target.value;
                setForm((p) => {
                  const keyChanged = containerCountryKey(p.country) !== containerCountryKey(next);
                  return {
                    ...p,
                    country: next,
                    ...(isEdit && keyChanged ? { isDefault: false } : {}),
                  };
                });
              }}
              className="input-field"
            >
              <option value="">— None —</option>
              <option value="India">India</option>
              <option value="Thailand">Thailand</option>
            </select>
          </div>
          <div>
            <label className="label">
              Status
            </label>
            <select
              name="status"
              value={form.status || 'in_storage_tlv'}
              onChange={handleChange}
              className="input-field"
            >
              {Object.entries(CONTAINER_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">
              Estimated arrival (optional)
            </label>
            <input
              name="estimatedArrivalLocal"
              type="datetime-local"
              value={form.estimatedArrivalLocal}
              onChange={handleChange}
              className="input-field"
            />
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-3">
            <div className="text-sm text-slate-800 text-left">
              <span className="font-medium text-slate-700">Default for this country: </span>
              {defaultContainer ? (
                <span className="text-indigo-700 font-medium">{formatContainerLabel(defaultContainer)}</span>
              ) : (
                <span className="text-slate-500">
                  None — no default for {form.country ? form.country : 'containers with no country'}
                </span>
              )}
            </div>
            {thisIsDefault && (
              <p className="text-xs text-slate-600 leading-relaxed text-left border-t border-slate-200/80 pt-2">
                To set a different default for this country: uncheck here, save, then mark another container with the same
                country as default.
              </p>
            )}
            {hasOtherDefault && !thisIsDefault && defaultContainer && (
              <p className="text-xs text-slate-600 leading-relaxed text-left border-t border-slate-200/80 pt-2">
                To set this as the default for this country, first remove the default from{' '}
                <span className="font-medium text-slate-800">{formatContainerLabel(defaultContainer)}</span>.
              </p>
            )}
            {!hasOtherDefault && (
              <label className="flex items-start gap-3 cursor-pointer pt-1 border-t border-slate-200/80">
                <input
                  type="checkbox"
                  name="isDefault"
                  checked={form.isDefault}
                  onChange={(e) => setForm((p) => ({ ...p, isDefault: e.target.checked }))}
                  className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-slate-700 text-left">
                  <span className="font-medium text-slate-800">Default container (this country)</span>
                  <span className="block text-slate-500 mt-0.5">
                    One default per country. Pickup missions without a <code className="text-xs bg-slate-100 px-1 rounded">containerId</code> use the default for the same <code className="text-xs bg-slate-100 px-1 rounded">country</code> in the API request (legacy: if <code className="text-xs bg-slate-100 px-1 rounded">country</code> is omitted, the first default in the list is used).
                  </span>
                </span>
              </label>
            )}
          </div>
          <div>
            <label className="label">
              Max packages *
            </label>
            <input
              name="maxPackages"
              type="number"
              min="1"
              value={form.maxPackages}
              onChange={handleChange}
              placeholder="220"
              className="input-field"
              required
            />
          </div>

          <div className="pt-4 border-t border-slate-200">
            <p className="label mb-3">Shipper details (optional)</p>
            <div className="space-y-3">
              <input
                name="shipperName"
                value={form.shipperName}
                onChange={handleChange}
                placeholder="Shipper name"
                className="input-field"
              />
              <input
                name="shipperId"
                value={form.shipperId}
                onChange={handleChange}
                placeholder="ID"
                className="input-field"
              />
              <input
                name="address"
                value={form.address}
                onChange={handleChange}
                placeholder="Address"
                className="input-field"
              />
              <input
                name="phone"
                type="tel"
                value={form.phone}
                onChange={handleChange}
                placeholder="Phone"
                className="input-field"
              />
            </div>
          </div>

          <div>
            <label className="label">Images & Videos (optional)</label>
            <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/50 text-slate-600 text-sm mb-2 transition-colors">
              <ImagePlus className="w-4 h-4" />
              Add images or videos
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleMediaAdd}
                className="hidden"
              />
            </label>
            {mediaItems.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {mediaItems.map((item, i) => (
                  <div key={i} className="relative group">
                    {item.type === 'image' ? (
                      <img
                        src={item.preview}
                        alt=""
                        className="w-20 h-20 object-cover rounded-xl border border-slate-200 cursor-pointer hover:ring-2 hover:ring-indigo-400 transition-shadow"
                        onClick={() => setExpandedMediaIndex(i)}
                      />
                    ) : (
                      <div
                        className="w-20 h-20 rounded-xl border border-slate-200 bg-slate-100 flex items-center justify-center relative cursor-pointer hover:ring-2 hover:ring-indigo-400 transition-shadow"
                        onClick={() => setExpandedMediaIndex(i)}
                      >
                        <Video className="w-8 h-8 text-slate-500" />
                        <span className="absolute bottom-0 left-0 right-0 text-[10px] truncate px-1 bg-black/60 text-white rounded-b-xl">
                          {item.fileName || item.file?.name || 'video'}
                        </span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeMedia(i); }}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {expandedMediaIndex !== null && mediaItems[expandedMediaIndex] && (
              <div
                className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
                onClick={() => setExpandedMediaIndex(null)}
              >
                <div className="max-w-[90vw] max-h-[90vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                  {mediaItems[expandedMediaIndex].type === 'image' ? (
                    <img
                      src={mediaItems[expandedMediaIndex].preview}
                      alt=""
                      className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <video
                      src={mediaItems[expandedMediaIndex].preview}
                      controls
                      autoPlay
                      className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl"
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setExpandedMediaIndex(null)}
                  className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
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
            {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create container'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteContainerModal({ container, containers, packagesCount, onConfirm, onClose, deleting }) {
  const countryKey = containerCountryKey(container.country);
  const sameCountryAlternatives = containers.filter(
    (c) => c.id !== container.id && containerCountryKey(c.country) === countryKey,
  );
  const otherContainers = containers.filter((c) => c.id !== container.id);
  const isDefault = Boolean(container.isDefault);
  const needsNewDefault = isDefault && sameCountryAlternatives.length > 0;
  const hasPackages = packagesCount > 0;
  const showDefaultStep = isDefault;

  const [newDefaultId, setNewDefaultId] = useState(sameCountryAlternatives[0]?.id ?? '');
  const [movePackages, setMovePackages] = useState(hasPackages && otherContainers.length > 0);
  const [movePackagesTo, setMovePackagesTo] = useState(
    sameCountryAlternatives[0]?.id ?? otherContainers[0]?.id ?? '',
  );

  useEffect(() => {
    if (newDefaultId && movePackages && !movePackagesTo) {
      setMovePackagesTo(newDefaultId);
    }
  }, [newDefaultId, movePackages, movePackagesTo]);

  const step1Complete = !needsNewDefault || Boolean(newDefaultId);
  const canConfirm = step1Complete && (!hasPackages || !movePackages || Boolean(movePackagesTo));

  const handleConfirm = () => {
    onConfirm({
      newDefaultId: needsNewDefault ? newDefaultId : null,
      movePackagesTo: movePackages ? movePackagesTo : null,
    });
  };

  const totalSteps = (showDefaultStep ? 1 : 0) + (hasPackages ? 1 : 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800">Delete container</h3>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <p className="text-sm text-slate-600">
            You are about to delete <span className="font-semibold text-slate-800">{formatContainerLabel(container)}</span>
            {container.country ? ` (${container.country})` : ''}.
          </p>

          {totalSteps > 1 && (
            <p className="text-xs font-medium text-indigo-600 uppercase tracking-wide">
              {totalSteps}-step delete
            </p>
          )}

          {showDefaultStep && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 space-y-3">
              {totalSteps > 1 && (
                <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Step 1 — Default</p>
              )}
              <div className="flex gap-2">
                <Star className="w-5 h-5 text-amber-600 shrink-0 fill-amber-400/30 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-800">Default container</p>
                  {needsNewDefault ? (
                    <p className="text-sm text-slate-600 mt-1">
                      This is the default for {container.country || 'this country'}. Choose another container to become the new default before deleting.
                    </p>
                  ) : (
                    <p className="text-sm text-slate-600 mt-1">
                      This is the default for {container.country || 'this country'}, and there is no other container in the same country. After deletion, new pickup missions will not auto-assign to a container.
                    </p>
                  )}
                </div>
              </div>
              {needsNewDefault && (
                <select
                  value={newDefaultId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setNewDefaultId(id);
                    if (movePackages) setMovePackagesTo(id);
                  }}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  {sameCountryAlternatives.map((c) => (
                    <option key={c.id} value={c.id}>
                      {formatContainerLabel(c)}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {hasPackages && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              {totalSteps > 1 && (
                <p className="text-xs font-semibold text-indigo-800 uppercase tracking-wide">
                  Step {showDefaultStep ? 2 : 1} — Packages
                </p>
              )}
              <div className="flex gap-2">
                <Package className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-800">Packages in this container</p>
                  <p className="text-sm text-slate-600 mt-1">
                    {packagesCount} pickup package{packagesCount !== 1 ? 's' : ''} assigned. Move them to another container, or leave them without a container.
                  </p>
                </div>
              </div>
              <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="movePackages"
                  checked={movePackages}
                  onChange={() => {
                    setMovePackages(true);
                    if (!movePackagesTo) {
                      setMovePackagesTo(newDefaultId || otherContainers[0]?.id || '');
                    }
                  }}
                  className="mt-0.5"
                />
                <span>Move all packages to another container</span>
              </label>
              {movePackages && (
                <select
                  value={movePackagesTo}
                  onChange={(e) => setMovePackagesTo(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm ml-6"
                >
                  {otherContainers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {formatContainerLabel(c)}{c.country ? ` — ${c.country}` : ''}
                    </option>
                  ))}
                </select>
              )}
              <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="movePackages"
                  checked={!movePackages}
                  onChange={() => setMovePackages(false)}
                  className="mt-0.5"
                />
                <span>Leave packages without a container (&quot;No container&quot;)</span>
              </label>
              {movePackages && newDefaultId && movePackagesTo === newDefaultId && (
                <p className="text-xs text-indigo-700 bg-indigo-50 rounded-lg px-3 py-2">
                  Recommended: moving packages to the new default keeps pickup routing consistent.
                </p>
              )}
            </div>
          )}

          {!showDefaultStep && !hasPackages && (
            <p className="text-sm text-slate-600">This container has no assigned packages. This action cannot be undone.</p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <button type="button" onClick={onClose} className="btn-secondary" disabled={deleting}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={deleting || !canConfirm}
            className="btn-primary bg-red-600 hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete container'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ContainersPanel() {
  const [containers, setContainers] = useState([]);
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingContainer, setEditingContainer] = useState(null);
  const [viewingContainer, setViewingContainer] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deletingContainer, setDeletingContainer] = useState(null);
  const [exportModalContainer, setExportModalContainer] = useState(null);
  const [summaryModalContainer, setSummaryModalContainer] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [containersRes, missionsRes] = await Promise.all([
        fetch(`${API_BASE}/containers`),
        fetch(`${API_BASE}/missions`),
      ]);
      if (!containersRes.ok) throw new Error('Failed to fetch containers');
      if (!missionsRes.ok) throw new Error('Failed to fetch missions');
      const [containersData, missionsData] = await Promise.all([
        containersRes.json(),
        missionsRes.json(),
      ]);
      setContainers(containersData);
      setMissions(missionsData);
    } catch (e) {
      setError(e.message);
      setContainers([]);
      setMissions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const { packagesByContainer, weightByContainer } = missions.reduce(
    (acc, m) => {
      if (m.type === 'pickup' && m.containerId) {
        acc.packagesByContainer[m.containerId] = (acc.packagesByContainer[m.containerId] || 0) + 1;

        let weight = 0;
        const deliveries = m.deliveries ?? [];
        if (deliveries.length > 0) {
          deliveries.forEach((d) => {
            (d.boxWeights ?? []).forEach((w) => {
              const v = parseFloat(w);
              if (!isNaN(v)) weight += v;
            });
          });
        } else {
          (m.pickupBoxWeights ?? []).forEach((w) => {
            const v = parseFloat(w);
            if (!isNaN(v)) weight += v;
          });
        }
        acc.weightByContainer[m.containerId] = (acc.weightByContainer[m.containerId] || 0) + weight;
      }
      return acc;
    },
    { packagesByContainer: {}, weightByContainer: {} }
  );

  const containersWithStats = containers.map((c) => {
    const packagesCount = packagesByContainer[c.id] || 0;
    const currentWeight = weightByContainer[c.id] || 0;
    const capacityPercent = c.maxPackages > 0
      ? Math.round((packagesCount / c.maxPackages) * 100)
      : 0;
    const isAtCapacityAlert = capacityPercent >= CAPACITY_ALERT_THRESHOLD;
    return { ...c, packagesCount, currentWeight, capacityPercent, isAtCapacityAlert };
  });

  const handleDeleteConfirm = async ({ newDefaultId, movePackagesTo }) => {
    if (!deletingContainer) return;
    setDeletingId(deletingContainer.id);
    try {
      const res = await fetch(`${API_BASE}/containers/${deletingContainer.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(newDefaultId ? { newDefaultId } : {}),
          ...(movePackagesTo ? { movePackagesTo } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete');
      }
      setDeletingContainer(null);
      await fetchData();
    } catch (e) {
      setError(e.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSave = (saved) => {
    setContainers((prev) => {
      const idx = prev.findIndex((c) => c.id === saved.id);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [...prev, saved];
    });
    setShowForm(false);
    setEditingContainer(null);
  };

  const containersOver70 = containersWithStats.filter((c) => c.isAtCapacityAlert);
  const defaultContainersInList = containers.filter((c) => c.isDefault);

  const exportAllContainers = () => {
    const escapeCsv = (val) => {
      const s = String(val ?? '');
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const exportDateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const headers = ['ID', 'Name', 'Country', 'Status', 'Default', 'Estimated arrival', 'Created At'];
    const csvLines = [`Date: ${exportDateStr}`, headers.map(escapeCsv).join(',')];
    containers.forEach((c) => {
      const createdAt = c.createdAt
        ? new Date(c.createdAt).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })
        : '';
      const st = c.status || 'in_storage_tlv';
      const statusLabel = CONTAINER_STATUS_LABELS[st] || st;
      const arrival =
        c.estimatedArrivalAt && !Number.isNaN(new Date(c.estimatedArrivalAt).getTime())
          ? new Date(c.estimatedArrivalAt).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })
          : '';
      const defLabel = c.isDefault ? 'Yes' : '';
      csvLines.push([c.id, c.name || '', c.country || '', statusLabel, defLabel, arrival, createdAt].map(escapeCsv).join(','));
    });
    const csv = '\uFEFF' + csvLines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `containers-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getContainerExportRowsCustoms = (container) => {
    const containerPackages = missions.filter((m) => m.type === 'pickup' && m.containerId === container.id);
    const rows = [];
    containerPackages.forEach((m) => {
      const deliveries = m.deliveries ?? [];
      const hasDeliveries = deliveries.length > 0;
      const items = hasDeliveries ? deliveries : [{ boxContents: [], boxWeights: m.pickupBoxWeights ?? [], boxTrackingIds: [] }];
      items.forEach((d) => {
        const boxContents = d.boxContents ?? [];
        const boxWeights = d.boxWeights ?? [];
        const boxTrackingIds = d.boxTrackingIds ?? [];
        const boxCount = Math.max(boxContents.length, boxWeights.length, boxTrackingIds.length, 1);
        for (let i = 0; i < boxCount; i++) {
          const arr = Array.isArray(boxContents[i]) ? boxContents[i] : [];
          const descStr = arr
            .filter((it) => it?.description)
            .map((it) => it.description)
            .join(', ');
          const weight = boxWeights[i] != null && String(boxWeights[i]).trim() !== '' ? parseFloat(boxWeights[i]) : '';
          rows.push({
            packageId: m.id,
            description: descStr || '—',
            weight: typeof weight === 'number' ? weight : '',
          });
        }
      });
    });
    return rows;
  };

  const getContainerExportRowsCourier = (container) => {
    const containerPackages = missions.filter((m) => m.type === 'pickup' && m.containerId === container.id);
    const rows = [];
    containerPackages.forEach((m) => {
      const deliveries = m.deliveries ?? [];
      const hasDeliveries = deliveries.length > 0;
      const items = hasDeliveries ? deliveries : [{ boxContents: [], boxWeights: m.pickupBoxWeights ?? [], boxTrackingIds: [], receiverName: m.receiverName, receiverPhone: m.receiverPhone, address: m.receiverAddress }];
      const senderName = m.fullName || '';
      const senderPhone = m.customerPhone || '';
      items.forEach((d) => {
        const boxWeights = d.boxWeights ?? [];
        const boxTrackingIds = d.boxTrackingIds ?? [];
        const boxCount = Math.max(boxWeights.length, boxTrackingIds.length, 1);
        const receiverName = d.receiverName || m.receiverName || '';
        const receiverPhone = d.receiverPhone || m.receiverPhone || '';
        const receiverAddress = d.address?.displayAddress || m.receiverAddress?.displayAddress || '';
        for (let i = 0; i < boxCount; i++) {
          const weight = boxWeights[i] != null && String(boxWeights[i]).trim() !== '' ? parseFloat(boxWeights[i]) : '';
          rows.push({
            packageId: m.id,
            receiverName,
            receiverPhone,
            receiverAddress,
            senderName,
            senderPhone,
            weight: typeof weight === 'number' ? weight : '',
          });
        }
      });
    });
    return rows;
  };

  const exportContainer = (container, exportType) => {
    const isCourier = exportType === 'courier';
    const rows = isCourier ? getContainerExportRowsCourier(container) : getContainerExportRowsCustoms(container);
    const containerName = container.name || container.id;
    const suffix = isCourier ? 'courier' : 'customs';

    const escapeCsv = (val) => {
      const s = String(val ?? '');
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const csvExportDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const headers = isCourier
      ? ['Package ID', 'Recipient Name', 'Recipient Phone', 'Recipient Address', 'Sender Name', 'Sender Phone', 'Weight (kg)']
      : ['Package ID', 'Description', 'Weight (kg)'];
    const csvLines = [`Date: ${csvExportDate}`, headers.map(escapeCsv).join(',')];
    rows.forEach((r) => {
      const cells = isCourier
        ? [r.packageId, r.receiverName, r.receiverPhone, r.receiverAddress, r.senderName, r.senderPhone, r.weight]
        : [r.packageId, r.description, r.weight];
      csvLines.push(cells.map(escapeCsv).join(','));
    });
    const csv = '\uFEFF' + csvLines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `container-${containerName}-${suffix}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportModalContainer(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="stat-card border-l-4 border-indigo-500">
          <div className="text-3xl font-extrabold text-slate-800">{containers.length}</div>
          <div className="text-sm text-slate-500 mt-1">Total containers</div>
        </div>
        <div className="stat-card border-l-4 border-violet-500">
          <div className="text-3xl font-extrabold text-violet-600">{missions.length}</div>
          <div className="text-sm text-slate-500 mt-1">Packages</div>
        </div>
        <div className="stat-card border-l-4 border-amber-500">
          <div className="text-3xl font-extrabold text-amber-600">
            {containersOver70.length}
          </div>
          <div className="text-sm text-slate-500 mt-1">Over 70% capacity</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3 rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-slate-800 shadow-sm">
        <Star className="w-5 h-5 text-amber-600 shrink-0 fill-amber-400/30" />
        <span className="font-semibold text-slate-700">Default containers</span>
        <span className="text-slate-400 hidden sm:inline">—</span>
        {defaultContainersInList.length > 0 ? (
          <span className="font-medium text-indigo-800">
            {defaultContainersInList
              .map((c) => `${c.country || '—'}: ${formatContainerLabel(c)}`)
              .join(' · ')}
          </span>
        ) : (
          <span className="text-slate-500">None set — choose one per country when creating or editing a container</span>
        )}
      </div>

      <div className="card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-wrap gap-2">
          <h2 className="section-title">
            <Box className="w-5 h-5 text-indigo-500" />
            Containers ({containers.length})
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={exportAllContainers}
              className="btn-secondary"
            >
              <Download className="w-4 h-4" />
              Export containers
            </button>
            <button
              onClick={() => {
                setEditingContainer(null);
                setShowForm(true);
              }}
              className="btn-primary"
            >
              <Plus className="w-4 h-4" />
              New container
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading...</div>
        ) : error ? (
          <div className="p-12 text-center text-red-600">{error}</div>
        ) : containers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <Box className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-base font-medium text-slate-500">No containers</p>
            <p className="text-sm text-slate-400 mt-1">Click &quot;New container&quot; to add one</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-center table-fixed">
              <thead>
                <tr className="table-header">
                  <th>ID / Name</th>
                  <th>Country</th>
                  <th>Status</th>
                  <th>Est. arrival</th>
                  <th>Max packages</th>
                  <th>Current packages</th>
                  <th>Current weight</th>
                  <th>Capacity %</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {containersWithStats.map((c) => (
                  <tr
                    key={c.id}
                    className={`table-row ${
                      c.isAtCapacityAlert ? 'row-warning' : ''
                    }`}
                  >
                    <td>
                      <div className="flex flex-col items-center justify-center gap-0.5">
                        <span className="table-id">{c.id}</span>
                        {c.name && (
                          <span className="text-xs text-slate-500 font-medium">{c.name}</span>
                        )}
                      </div>
                    </td>
                    <td className="text-sm text-slate-700">
                      {c.country || '—'}
                    </td>
                    <td>
                      <span
                        className={`badge-pill font-medium ${containerStatusBadgeClass(c.status)}`}
                      >
                        {CONTAINER_STATUS_LABELS[c.status || 'in_storage_tlv'] || c.status || '—'}
                      </span>
                    </td>
                    <td className="text-sm text-slate-700 whitespace-nowrap">
                      {formatEstimatedArrival(c.estimatedArrivalAt)}
                    </td>
                    <td>
                      <span className="inline-flex items-center justify-center gap-1 text-sm font-medium text-slate-700">
                        <Package className="w-4 h-4 text-slate-400" />
                        {c.maxPackages}
                      </span>
                    </td>
                    <td>
                      <span className="text-sm font-bold text-indigo-600">
                        {c.packagesCount}
                      </span>
                    </td>
                    <td>
                      <span className="inline-flex items-center justify-center gap-1 text-sm font-medium text-slate-700">
                        <Weight className="w-4 h-4 text-slate-400" />
                        {c.currentWeight.toFixed(1)} kg
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge-pill font-bold ${
                          c.isAtCapacityAlert
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {c.isAtCapacityAlert && (
                          <AlertTriangle className="w-3.5 h-3.5" />
                        )}
                        {c.capacityPercent}%
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          onClick={() => setSummaryModalContainer(c)}
                          className="action-btn hover:bg-amber-50 text-slate-400 hover:text-amber-600"
                          title="Container summary"
                        >
                          <FileCheck className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setExportModalContainer(c)}
                          className="action-btn hover:bg-green-50 text-slate-400 hover:text-green-600"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setViewingContainer(c)}
                          className="action-btn hover:bg-indigo-50 text-slate-400 hover:text-indigo-600"
                          title="View packages"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingContainer(c);
                            setShowForm(true);
                          }}
                          className="action-btn hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeletingContainer(c)}
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
      </div>

      {showForm && (
        <ContainerFormModal
          container={editingContainer}
          containers={containers}
          onSave={handleSave}
          onClose={() => {
            setShowForm(false);
            setEditingContainer(null);
          }}
        />
      )}

      {viewingContainer && (
        <ContainerPackagesModal
          container={viewingContainer}
          packages={missions.filter((m) => m.type === 'pickup' && m.containerId === viewingContainer.id)}
          onClose={() => setViewingContainer(null)}
        />
      )}

      {exportModalContainer && (
        <ExportOptionsModal
          onExport={(exportType) => exportContainer(exportModalContainer, exportType)}
          onClose={() => setExportModalContainer(null)}
        />
      )}

      {summaryModalContainer && (
        <ContainerSummaryModal
          container={summaryModalContainer}
          packages={missions.filter((m) => m.type === 'pickup' && m.containerId === summaryModalContainer.id)}
          onClose={() => setSummaryModalContainer(null)}
        />
      )}

      {deletingContainer && (
        <DeleteContainerModal
          container={deletingContainer}
          containers={containers}
          packagesCount={packagesByContainer[deletingContainer.id] || 0}
          onConfirm={handleDeleteConfirm}
          onClose={() => !deletingId && setDeletingContainer(null)}
          deleting={deletingId === deletingContainer.id}
        />
      )}
    </div>
  );
}
