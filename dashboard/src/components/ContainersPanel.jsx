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
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { API_BASE } from '../config';

const CAPACITY_ALERT_THRESHOLD = 70;

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

  // Aggregate parcel content by type and total weight across all packages
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
          <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <Package className="w-5 h-5" />
            Packages in {container.name || container.id} ({packages.length})
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {packages.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No packages in this container</p>
          ) : (
            <>
              {/* Summary card - different color */}
              {hasSummary && (
                <div className="p-4 rounded-xl bg-indigo-600 text-white shadow-lg">
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

              {/* Individual packages */}
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
                          <p className="font-mono font-bold text-blue-600 text-sm">{m.id}</p>
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
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                            {TYPE_LABELS[m.type] || m.type}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">
                            {STATUS_LABELS[m.status] || m.status}
                          </span>
                        </div>
                      </div>

                      {/* Parcel content per delivery */}
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
  const [exportType, setExportType] = useState('courier'); // 'courier' | 'customs'
  const [fileType, setFileType] = useState('excel'); // 'excel' | 'pdf'

  const handleConfirm = () => {
    onExport(exportType, fileType);
    onClose();
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
          <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <Download className="w-5 h-5" />
            Export Options
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-6">
          <div>
            <p className="text-sm font-medium text-slate-700 mb-3">Export type</p>
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
            <p className="text-sm font-medium text-slate-700 mb-3">File format</p>
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
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold"
            >
              Export
            </button>
          </div>
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
          // ignore
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

  // Aggregate content by description (like GOODS DECLARATION table)
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

    // Date at top left
    const downloadDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Date: ${downloadDate}`, 14, y + 4);
    y += 10;

    // Logo at top
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
      // fallback if logo fails
      doc.setFontSize(16);
      doc.setTextColor(...blue);
      doc.text('ISA WORLD EXPRESS', 14, y + 6);
      y += 14;
    }

    // GOODS DECLARATION
    doc.setFontSize(16);
    doc.setTextColor(...blue);
    doc.text('GOODS DECLARATION', pageW / 2, y + 4, { align: 'center' });
    y += 8;
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.text('Invoice:', 14, y + 4);
    y += 10;

    // Small table: issue date, shipper name, id, address, phone
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

    // Summary: total number of packages, total gross weight
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

    // Large table: DESCRIPTION, QTY, PRICE, TOTAL
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white">
          <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <FileCheck className="w-5 h-5" />
            Container Summary – {container?.name || container?.id}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Shipper Name *</label>
            <input
              name="shipperName"
              value={form.shipperName}
              onChange={handleChange}
              placeholder="SHERON FONSEKA"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ID *</label>
            <input
              name="shipperId"
              value={form.shipperId}
              onChange={handleChange}
              placeholder="Y9572252"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Address *</label>
            <input
              name="address"
              value={form.address}
              onChange={handleChange}
              placeholder="NELLIAMPATHY, KERALA. COCHIN"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone *</label>
            <input
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
              placeholder="+972..."
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Images & Videos (optional)</label>
            <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-200 rounded-lg cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/50 text-slate-600 text-sm mb-2">
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
                        className="w-20 h-20 object-cover rounded-lg border border-slate-200 cursor-pointer hover:ring-2 hover:ring-indigo-400 transition-shadow"
                        onClick={() => setExpandedMediaIndex(i)}
                      />
                    ) : (
                      <div
                        className="w-20 h-20 rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center relative cursor-pointer hover:ring-2 hover:ring-indigo-400 transition-shadow"
                        onClick={() => setExpandedMediaIndex(i)}
                      >
                        <Video className="w-8 h-8 text-slate-500" />
                        <span className="absolute bottom-0 left-0 right-0 text-[10px] truncate px-1 bg-black/60 text-white rounded-b-lg">
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
                      className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <video
                      src={mediaItems[expandedMediaIndex].preview}
                      controls
                      autoPlay
                      className="max-w-full max-h-[90vh] rounded-lg shadow-2xl"
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
          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={downloadSummary}
              disabled={!isFormValid}
              className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Download container summary
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContainerFormModal({ container, onSave, onClose }) {
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
          // ignore
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white">
          <h2 className="font-bold text-slate-800 text-lg">
            {isEdit ? 'Edit container' : 'New container'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Name (optional)
            </label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Container 1"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Country (optional)
            </label>
            <input
              name="country"
              value={form.country}
              onChange={handleChange}
              placeholder="Israel"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Max weight (kg) *
            </label>
            <input
              name="maxWeight"
              type="number"
              min="1"
              value={form.maxWeight}
              onChange={handleChange}
              placeholder="100"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Max packages *
            </label>
            <input
              name="maxPackages"
              type="number"
              min="1"
              value={form.maxPackages}
              onChange={handleChange}
              placeholder="50"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              required
            />
          </div>

          <div className="pt-4 border-t border-slate-200">
            <p className="text-sm font-medium text-slate-600 mb-3">Shipper details (optional)</p>
            <div className="space-y-3">
              <input
                name="shipperName"
                value={form.shipperName}
                onChange={handleChange}
                placeholder="Shipper name"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <input
                name="shipperId"
                value={form.shipperId}
                onChange={handleChange}
                placeholder="ID"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <input
                name="address"
                value={form.address}
                onChange={handleChange}
                placeholder="Address"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <input
                name="phone"
                type="tel"
                value={form.phone}
                onChange={handleChange}
                placeholder="Phone"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Images & Videos (optional)</label>
            <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-200 rounded-lg cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/50 text-slate-600 text-sm mb-2">
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
                        className="w-20 h-20 object-cover rounded-lg border border-slate-200 cursor-pointer hover:ring-2 hover:ring-indigo-400 transition-shadow"
                        onClick={() => setExpandedMediaIndex(i)}
                      />
                    ) : (
                      <div
                        className="w-20 h-20 rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center relative cursor-pointer hover:ring-2 hover:ring-indigo-400 transition-shadow"
                        onClick={() => setExpandedMediaIndex(i)}
                      >
                        <Video className="w-8 h-8 text-slate-500" />
                        <span className="absolute bottom-0 left-0 right-0 text-[10px] truncate px-1 bg-black/60 text-white rounded-b-lg">
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
                      className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <video
                      src={mediaItems[expandedMediaIndex].preview}
                      controls
                      autoPlay
                      className="max-w-full max-h-[90vh] rounded-lg shadow-2xl"
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
              {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create container'}
            </button>
          </div>
        </form>
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
      // silent
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

  const exportAllContainers = () => {
    const escapeCsv = (val) => {
      const s = String(val ?? '');
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const exportDateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const headers = ['ID', 'Name', 'Country', 'Created At'];
    const csvLines = [`Date: ${exportDateStr}`, headers.map(escapeCsv).join(',')];
    containers.forEach((c) => {
      const createdAt = c.createdAt
        ? new Date(c.createdAt).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })
        : '';
      csvLines.push([c.id, c.name || '', c.country || '', createdAt].map(escapeCsv).join(','));
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
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="text-2xl font-bold text-slate-800">{containers.length}</div>
          <div className="text-sm text-slate-500">Total containers</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="text-2xl font-bold text-indigo-600">{missions.length}</div>
          <div className="text-sm text-slate-500">Packages</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="text-2xl font-bold text-amber-600">
            {containersOver70.length}
          </div>
          <div className="text-sm text-slate-500">Over 70% capacity</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b flex-wrap gap-2">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Box className="w-5 h-5" />
            Containers ({containers.length})
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={exportAllContainers}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Export containers
            </button>
            <button
              onClick={() => {
                setEditingContainer(null);
                setShowForm(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              New container
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-600">{error}</div>
        ) : containers.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <Box className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>No containers</p>
            <p className="text-sm mt-1">Click &quot;New container&quot; to add one</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-center table-fixed">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase">
                  <th className="px-4 py-3">ID / Name</th>
                  <th className="px-4 py-3">Country</th>
                  <th className="px-4 py-3">Max weight</th>
                  <th className="px-4 py-3">Max packages</th>
                  <th className="px-4 py-3">Current packages</th>
                  <th className="px-4 py-3">Current weight</th>
                  <th className="px-4 py-3">Capacity %</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {containersWithStats.map((c) => (
                  <tr
                    key={c.id}
                    className={`border-b border-slate-100 hover:bg-slate-50/50 ${
                      c.isAtCapacityAlert ? 'bg-amber-50/50' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-mono font-bold text-blue-600 text-sm flex flex-col items-center justify-center">
                        {c.id}
                        {c.name && (
                          <span className="text-sm text-slate-600 font-normal">{c.name}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {c.country || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center justify-center gap-1 text-sm font-medium text-slate-700">
                        <Weight className="w-4 h-4 text-slate-400" />
                        {c.maxWeight} kg
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center justify-center gap-1 text-sm font-medium text-slate-700">
                        <Package className="w-4 h-4 text-slate-400" />
                        {c.maxPackages}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-bold text-indigo-600">
                        {c.packagesCount}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center justify-center gap-1 text-sm font-medium text-slate-700">
                        <Weight className="w-4 h-4 text-slate-400" />
                        {c.currentWeight.toFixed(1)} kg
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center justify-center gap-1 text-sm font-bold px-2.5 py-1 rounded-full ${
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
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setSummaryModalContainer(c)}
                          className="p-1.5 hover:bg-amber-50 rounded text-slate-400 hover:text-amber-600"
                          title="Container summary"
                        >
                          <FileCheck className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setExportModalContainer(c)}
                          className="p-1.5 hover:bg-green-50 rounded text-slate-400 hover:text-green-600"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setViewingContainer(c)}
                          className="p-1.5 hover:bg-indigo-50 rounded text-slate-400 hover:text-indigo-600"
                          title="View packages"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingContainer(c);
                            setShowForm(true);
                          }}
                          className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
                          disabled={deletingId === c.id}
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
        <ContainerFormModal
          container={editingContainer}
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
