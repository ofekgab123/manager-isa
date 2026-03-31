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
  FileText,
  FileCheck,
  ImagePlus,
  Video,
  Star,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { API_BASE } from '../config';

const CAPACITY_ALERT_THRESHOLD = 70;

const CONTAINER_STATUS_LABELS = {
  open: 'Open',
  closed: 'Closed',
  in_transit: 'In transit',
  completed: 'Completed',
};

function containerStatusBadgeClass(status) {
  const s = status || 'open';
  if (s === 'open') return 'bg-emerald-100 text-emerald-800';
  if (s === 'closed') return 'bg-amber-100 text-amber-800';
  if (s === 'in_transit') return 'bg-indigo-100 text-indigo-800';
  if (s === 'completed') return 'bg-slate-200 text-slate-800';
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

function ExportOptionsModal({ container, onExport, onClose }) {
  const [exportType, setExportType] = useState('courier');
  const [fileType, setFileType] = useState('excel');

  const handleConfirm = () => {
    onExport(exportType, fileType);
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
          <div>
            <p className="label mb-3">File format</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setFileType('excel')}
                className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  fileType === 'excel'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                Excel (CSV)
              </button>
              <button
                type="button"
                onClick={() => setFileType('pdf')}
                className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  fileType === 'pdf'
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <FileText className="w-4 h-4" />
                PDF
              </button>
            </div>
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

  const downloadSummary = async () => {
    const { rows, totalWeight, totalPackages, totalQty, grandTotal } = getContentRows();
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const blue = [51, 102, 204];

    let y = 10;

    const downloadDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Date: ${downloadDate}`, 14, y + 4);
    y += 10;

    try {
      const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || '';
      const logoUrl = `${window.location.origin}${base ? base + '/' : '/'}isa-logo-pdf.png`;
      const logoRes = await fetch(logoUrl);
      if (logoRes.ok) {
        const logoBlob = await logoRes.blob();
        const logoBase64 = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result);
          r.onerror = reject;
          r.readAsDataURL(logoBlob);
        });
        const logoW = Math.min(80, pageW - 28);
        doc.addImage(logoBase64, 'PNG', 14, y, logoW, logoW * 0.4);
        y += logoW * 0.4 + 8;
      }
    } catch {
      doc.setFontSize(16);
      doc.setTextColor(...blue);
      doc.text('ISA WORLD EXPRESS', 14, y + 6);
      y += 14;
    }

    doc.setFontSize(16);
    doc.setTextColor(...blue);
    doc.text('GOODS DECLARATION', pageW / 2, y + 4, { align: 'center' });
    y += 8;
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.text('Invoice:', 14, y + 4);
    y += 10;

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    const lineH = 5;
    const tableH = lineH * 5 + 6;
    doc.rect(14, y, pageW - 28, tableH);
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    const issueDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    doc.text(`Issue date: ${issueDate}`, 18, y + 5);
    doc.text(`Shipper name: ${form.shipperName}`, 18, y + 10);
    doc.text(`ID: ${form.shipperId}`, 18, y + 15);
    doc.text(`Address: ${form.address}`, 18, y + 20);
    doc.text(`Phone: ${form.phone}`, 18, y + 25);
    y += tableH + 6;

    doc.setFillColor(230, 235, 240);
    const summaryH = 10;
    doc.rect(14, y, pageW - 28, summaryH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.text(`Total number of packages: ${totalPackages}`, 18, y + 4);
    doc.text(`Total gross weight: ${totalWeight.toFixed(2)} KG`, 18, y + 8);
    doc.setFont('helvetica', 'normal');
    y += summaryH + 6;

    const colW = [(pageW - 28) * 0.5, (pageW - 28) * 0.15, (pageW - 28) * 0.17, (pageW - 28) * 0.18];
    const headers = ['DESCRIPTION', 'QTY', 'PRICE', 'TOTAL'];
    const headerH = 7;
    doc.setFillColor(217, 224, 242);
    doc.rect(14, y, pageW - 28, headerH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    let x = 18;
    headers.forEach((h, i) => {
      doc.text(h, x, y + 5);
      x += colW[i];
    });
    doc.setFont('helvetica', 'normal');
    y += headerH + 2;

    rows.forEach((r) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      x = 18;
      doc.text(String(r.description).substring(0, 50), x, y + 4);
      x += colW[0];
      doc.text(String(r.qty), x, y + 4);
      x += colW[1];
      doc.text(`NIS ${r.unitPrice.toFixed(2)}`, x, y + 4);
      x += colW[2];
      doc.text(`NIS ${r.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, x, y + 4);
      y += 6;
    });

    if (y > 258) {
      doc.addPage();
      y = 20;
    }
    const footerH = 10;
    y += 2;
    doc.setFont('helvetica', 'bold');
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.rect(14, y, pageW - 28, footerH, 'S');
    doc.text(String(totalQty), 18 + colW[0], y + 6);
    doc.text(`NIS ${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 14 + colW[0] + colW[1] + colW[2] + 4, y + 6);

    const fileName = `goods-declaration-${container.name || container.id}-${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(fileName);
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
            Download container summary
          </button>
        </div>
      </div>
    </div>
  );
}

function ContainerFormModal({ container, onSave, onClose, containers = [] }) {
  const isEdit = !!container;
  const defaultContainer = containers.find((c) => c.isDefault) ?? null;
  const thisIsDefault = Boolean(container?.id && defaultContainer?.id === container.id);
  const hasOtherDefault = Boolean(defaultContainer && (!container || defaultContainer.id !== container.id));
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
    status: container?.status || 'open',
    estimatedArrivalLocal: isoToDatetimeLocal(container?.estimatedArrivalAt),
    isDefault: Boolean(container?.isDefault),
    maxWeight: container?.maxWeight ?? '',
    maxPackages: container?.maxPackages ?? '',
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
    const maxWeight = Number(form.maxWeight);
    const maxPackages = Number(form.maxPackages);
    if (!(maxWeight > 0) || !(maxPackages > 0)) {
      setError('Max weight and max packages must be positive numbers');
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
        status: form.status || 'open',
        estimatedArrivalAt: datetimeLocalToIso(form.estimatedArrivalLocal),
        isDefault: form.isDefault,
        maxWeight,
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
              onChange={handleChange}
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
              value={form.status || 'open'}
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
              <span className="font-medium text-slate-700">Current system default: </span>
              {defaultContainer ? (
                <span className="text-indigo-700 font-medium">{formatContainerLabel(defaultContainer)}</span>
              ) : (
                <span className="text-slate-500">None — no default container is set</span>
              )}
            </div>
            {thisIsDefault && (
              <p className="text-xs text-slate-600 leading-relaxed text-left border-t border-slate-200/80 pt-2">
                To set a different default: uncheck &quot;Default container&quot; on this container, save, then open the
                container you want and mark it as default.
              </p>
            )}
            {hasOtherDefault && !thisIsDefault && defaultContainer && (
              <p className="text-xs text-slate-600 leading-relaxed text-left border-t border-slate-200/80 pt-2">
                To set this as default, first remove the default from{' '}
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
                  <span className="font-medium text-slate-800">Default container</span>
                  <span className="block text-slate-500 mt-0.5">
                    Only one container can be default. New pickup missions without a <code className="text-xs bg-slate-100 px-1 rounded">containerId</code> in the API are assigned here automatically.
                  </span>
                </span>
              </label>
            )}
          </div>
          <div>
            <label className="label">
              Max weight (kg) *
            </label>
            <input
              name="maxWeight"
              type="number"
              min="1"
              value={form.maxWeight}
              onChange={handleChange}
              placeholder="100"
              className="input-field"
              required
            />
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
              placeholder="50"
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

export default function ContainersPanel() {
  const [containers, setContainers] = useState([]);
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingContainer, setEditingContainer] = useState(null);
  const [viewingContainer, setViewingContainer] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
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

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this container? Assigned packages will be set to "No container".')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${API_BASE}/containers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      await fetchData();
    } catch {
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
  const defaultContainerInList = containers.find((c) => c.isDefault) ?? null;

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
      const st = c.status || 'open';
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

  const exportContainer = (container, exportType, fileType) => {
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

    if (fileType === 'excel') {
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
    } else {
      const doc = new jsPDF({ orientation: 'landscape' });
      const exportDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`Date: ${exportDate}`, 14, 8);
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text(`Container: ${containerName} (${suffix})`, 14, 18);
      doc.setFontSize(9);
      const headers = isCourier
        ? ['Package ID', 'Recipient', 'Recipient Phone', 'Recipient Address', 'Sender', 'Sender Phone', 'Weight']
        : ['Package ID', 'Description', 'Weight (kg)'];
      const colWidths = isCourier
        ? [28, 32, 28, 55, 32, 28, 22]
        : [45, 100, 30];
      let y = 22;
      doc.setFillColor(240, 240, 240);
      doc.rect(14, y - 5, colWidths.reduce((a, b) => a + b, 0) + 10, 8, 'F');
      doc.setFont('helvetica', 'bold');
      headers.forEach((h, i) => {
        doc.text(h, 14 + colWidths.slice(0, i).reduce((a, b) => a + b, 0) + 5, y);
      });
      doc.setFont('helvetica', 'normal');
      y += 8;
      rows.forEach((r) => {
        if (y > 190) {
          doc.addPage('landscape');
          y = 20;
        }
        const cells = isCourier
          ? [r.packageId, r.receiverName, r.receiverPhone, r.receiverAddress, r.senderName, r.senderPhone, String(r.weight)]
          : [r.packageId, r.description, String(r.weight)];
        cells.forEach((cell, i) => {
          const text = String(cell).substring(0, 35);
          doc.text(text, 14 + colWidths.slice(0, i).reduce((a, b) => a + b, 0) + 5, y);
        });
        y += 6;
      });
      doc.save(`container-${containerName}-${suffix}.pdf`);
    }
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
        <span className="font-semibold text-slate-700">Default container</span>
        <span className="text-slate-400 hidden sm:inline">—</span>
        {defaultContainerInList ? (
          <span className="font-medium text-indigo-800">{formatContainerLabel(defaultContainerInList)}</span>
        ) : (
          <span className="text-slate-500">None set — choose one when creating or editing a container</span>
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
                  <th>Max weight</th>
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
                        {CONTAINER_STATUS_LABELS[c.status || 'open'] || c.status || '—'}
                      </span>
                    </td>
                    <td className="text-sm text-slate-700 whitespace-nowrap">
                      {formatEstimatedArrival(c.estimatedArrivalAt)}
                    </td>
                    <td>
                      <span className="inline-flex items-center justify-center gap-1 text-sm font-medium text-slate-700">
                        <Weight className="w-4 h-4 text-slate-400" />
                        {c.maxWeight} kg
                      </span>
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
          container={exportModalContainer}
          onExport={(exportType, fileType) => exportContainer(exportModalContainer, exportType, fileType)}
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
    </div>
  );
}
