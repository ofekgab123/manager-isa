import { useState, useEffect, useCallback, useMemo } from 'react';
import { MapPin, User, Save, Trash2, AlertTriangle, Copy, Video, Image, X, Tag, Link2, Info, Plus, Globe, Truck } from 'lucide-react';
import AddressPicker from './AddressPicker';
import PhoneInput from './PhoneInput';
import { API_BASE } from '../config';
import { maxPickupLinksForEmptyBox } from '../pickerSlots';
import EmptyBoxMissionPickerModal from './EmptyBoxMissionPickerModal';
import CollapsibleParcelContent from './CollapsibleParcelContent';
import PickupMissionPickerModal from './PickupMissionPickerModal';
import { SHIPPING_DESTINATIONS, missionLwRegionId } from '../shippingDestinations';
import { formatIls, sumAllDeliveriesContentsIls, valueIlsForTypeLabel } from '../parcelContentUtils';

const TYPE_OPTIONS = [
  { value: 'pickup',    label: 'Pickup Box' },
  { value: 'empty_box', label: 'Empty Box'  },
];

const STATUS_OPTIONS = [
  { value: 'received',              label: 'Received'     },
  { value: 'linewhel_transferred',  label: 'Transferred'  },
  { value: 'linewhel_scheduled',    label: 'Scheduled'    },
  { value: 'collected',             label: 'Collected'    },
  { value: 'shipped',               label: 'Shipped'      },
  { value: 'completed',             label: 'Completed'    },
];

function EditableField({ label, value, onChange, type = 'text', placeholder, readOnly }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className={`input-field ${readOnly ? 'bg-slate-50 text-slate-500 cursor-default' : ''}`}
      />
    </div>
  );
}

function AddressBlock({ addr, onChange, title = 'Address', missing = false }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const data = addr || {};
  return (
    <div className="card p-4 space-y-3">
      <h4 className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
        <MapPin className="w-4 h-4" />
        {title}
        {missing && (
          <span className="ml-auto badge-pill bg-amber-100 text-amber-600">
            <AlertTriangle className="w-3 h-3" /> Missing
          </span>
        )}
      </h4>
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="w-full flex items-center gap-2 px-3.5 py-2.5 border-2 border-dashed border-slate-300 rounded-xl text-sm hover:border-indigo-400 hover:bg-indigo-50/50 transition-all duration-200 text-slate-500 hover:text-indigo-600"
      >
        <MapPin className="w-4 h-4 flex-shrink-0" />
        <span className="truncate">{data.displayAddress || 'Pick location on map…'}</span>
      </button>
      {data.displayAddress && (
        <button type="button" onClick={() => onChange({})} className="text-xs text-red-500 hover:underline -mt-1 font-medium">
          Clear address
        </button>
      )}
      <AddressPicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(a) => {
          onChange({ ...data, ...a });
          setPickerOpen(false);
        }}
        initialPosition={data.lat != null ? [data.lat, data.lng] : undefined}
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <EditableField label="City"       value={data.city}        onChange={(v) => onChange({ ...data, city: v })} />
        <EditableField label="Street"     value={data.street}      onChange={(v) => onChange({ ...data, street: v })} />
        <EditableField label="House no."  value={data.houseNumber} onChange={(v) => onChange({ ...data, houseNumber: v })} />
        <EditableField label="Apartment"  value={data.apartment}   onChange={(v) => onChange({ ...data, apartment: v })} />
        <EditableField label="Floor"      value={data.floor}       onChange={(v) => onChange({ ...data, floor: v })} />
      </div>
      {data.displayAddress && (
        <p className="text-sm text-slate-600">{data.displayAddress}</p>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-slate-500">Coordinates:</span>
        {data.lat != null && data.lng != null ? (
          <>
            <code className="text-sm font-mono bg-slate-100 px-2.5 py-1 rounded-lg">
              {typeof data.lat === 'number' ? data.lat.toFixed(6) : data.lat}, {typeof data.lng === 'number' ? data.lng.toFixed(6) : data.lng}
            </code>
            <button type="button" onClick={() => navigator.clipboard?.writeText(`${data.lat}, ${data.lng}`)} className="action-btn hover:bg-slate-100 text-slate-500" title="Copy">
              <Copy className="w-4 h-4" />
            </button>
          </>
        ) : (
          <span className="text-sm text-slate-400 italic">Not set — use &quot;Change address&quot;</span>
        )}
      </div>
      {data.videoUrl && (
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1">
            <Video className="w-4 h-4" /> Verification video
          </div>
          <video src={data.videoUrl} controls className="w-full max-w-xs max-h-40 rounded-xl border bg-black" />
        </div>
      )}
      {data.imageUrl && (
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1">
            <Image className="w-4 h-4" /> Verification photo
          </div>
          <button type="button" onClick={() => setImagePreview(data.imageUrl)} className="block">
            <img src={data.imageUrl} alt="Verification" className="max-w-xs max-h-40 rounded-xl border object-contain cursor-zoom-in hover:opacity-90 transition-opacity" />
          </button>
        </div>
      )}
      {imagePreview && (
        <div className="modal-overlay z-50 bg-black/70" onClick={() => setImagePreview(null)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Escape' && setImagePreview(null)}>
          <img src={imagePreview} alt="Enlarged" className="max-w-full max-h-full object-contain rounded-xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

function DeliveryEditCard({ delivery, idx, onChange, totalPickup, otherAssigned, parcelContentTypes }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const addr = delivery.address || {};
  const maxForRow = (totalPickup ?? 1) - (otherAssigned ?? 0);
  const boxCount = delivery.boxCount ?? 1;

  const ensureBoxContents = (count) => {
    const prev = delivery.boxContents ?? [];
    return Array.from({ length: count }, (_, i) =>
      Array.isArray(prev[i]) ? prev[i] : []
    );
  };

  return (
    <div className="card p-4 border-2 border-slate-200 space-y-3">
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
          {idx + 1}
        </span>
        <span className="label !mb-0">
          Delivery {idx + 1}
        </span>
      </div>

      <div>
        <label className="label">
          Boxes for this address
          {maxForRow > 0 && <span className="text-slate-400 font-normal ml-1">(max {maxForRow})</span>}
        </label>
        <input
          type="number"
          min="1"
          max={Math.max(1, maxForRow)}
          value={boxCount}
          onChange={(e) => {
            const val = Math.min(Math.max(1, maxForRow), Math.max(1, parseInt(e.target.value) || 1));
            const boxContents = ensureBoxContents(val);
            onChange({ ...delivery, boxCount: val, boxContents });
          }}
          className="input-field"
        />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="label">Receiver name</label>
          <input
            value={delivery.receiverName || ''}
            onChange={(e) => onChange({ ...delivery, receiverName: e.target.value })}
            placeholder="Full name"
            className="input-field"
          />
        </div>
        <div>
          <label className="label">Receiver phone</label>
          <input
            value={delivery.receiverPhone || ''}
            onChange={(e) => onChange({ ...delivery, receiverPhone: e.target.value })}
            placeholder="050..."
            className="input-field"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className={`w-full flex items-center gap-2 px-3.5 py-2.5 border-2 border-dashed rounded-xl text-sm transition-all duration-200 ${
          addr.lat
            ? 'border-green-300 bg-green-50 text-green-700 hover:border-green-400'
            : 'border-slate-300 text-slate-500 hover:border-indigo-400 hover:bg-indigo-50/50'
        }`}
      >
        <MapPin className="w-4 h-4 flex-shrink-0" />
        <span className="truncate">{addr.displayAddress || 'Pick location on map…'}</span>
      </button>
      {addr.displayAddress && (
        <button type="button" onClick={() => onChange({ ...delivery, address: {} })} className="text-xs text-red-500 hover:underline -mt-1 font-medium">
          Clear address
        </button>
      )}
      <AddressPicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(a) => {
          onChange({ ...delivery, address: { ...addr, ...a } });
          setPickerOpen(false);
        }}
        initialPosition={addr.lat != null ? [addr.lat, addr.lng] : undefined}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <EditableField label="City"      value={addr.city}        onChange={(v) => onChange({ ...delivery, address: { ...addr, city: v } })} />
        <EditableField label="Street"    value={addr.street}      onChange={(v) => onChange({ ...delivery, address: { ...addr, street: v } })} />
        <EditableField label="House no." value={addr.houseNumber} onChange={(v) => onChange({ ...delivery, address: { ...addr, houseNumber: v } })} />
        <EditableField label="Apartment" value={addr.apartment}   onChange={(v) => onChange({ ...delivery, address: { ...addr, apartment: v } })} />
        <EditableField label="Floor"     value={addr.floor}       onChange={(v) => onChange({ ...delivery, address: { ...addr, floor: v } })} />
      </div>

      {addr.lat != null && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-slate-500">Coords:</span>
          <code className="text-xs font-mono bg-slate-100 px-2.5 py-1 rounded-lg">
            {typeof addr.lat === 'number' ? addr.lat.toFixed(6) : addr.lat},{' '}
            {typeof addr.lng === 'number' ? addr.lng.toFixed(6) : addr.lng}
          </code>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(`${addr.lat}, ${addr.lng}`)}
            className="action-btn hover:bg-slate-100 text-slate-500"
            title="Copy coordinates"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Parcel content per box */}
      {boxCount > 0 && (
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <CollapsibleParcelContent
            defaultOpen
            title={<span className="label !mb-0">Parcel content per box</span>}
            buttonClassName="flex items-center gap-1.5 w-full text-left rounded-lg hover:bg-slate-100/80 -mx-1 px-1 py-1 transition-colors"
          >
          <div className="space-y-3">
            {Array.from({ length: boxCount }, (_, i) => (
              <div key={i} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <label className="block text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Box {i + 1}</label>
                {((delivery.boxContents ?? [])[i] ?? []).map((item, j) => (
                  <div key={j} className="flex flex-wrap gap-2">
                    <select
                      value={item.description || ''}
                      onChange={(e) => {
                        const label = e.target.value;
                        const unit = valueIlsForTypeLabel(parcelContentTypes, label);
                        const contents = [...(delivery.boxContents ?? [])];
                        if (!contents[i]) contents[i] = [];
                        contents[i] = contents[i].map((it, k) =>
                          k === j ? { ...it, description: label, price: label ? unit : 0 } : it
                        );
                        onChange({ ...delivery, boxContents: contents });
                      }}
                      className="select-field flex-1 min-w-0 max-w-[12rem] !py-1.5"
                    >
                      <option value="">Select type</option>
                      {(parcelContentTypes ?? []).map((t) => (
                        <option key={t.id} value={t.label}>{t.label}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={item.qty ?? ''}
                      onChange={(e) => {
                        const contents = [...(delivery.boxContents ?? [])];
                        if (!contents[i]) contents[i] = [];
                        contents[i] = contents[i].map((it, k) =>
                          k === j ? { ...it, qty: parseInt(e.target.value) || 0 } : it
                        );
                        onChange({ ...delivery, boxContents: contents });
                      }}
                      placeholder="qty"
                      className="input-field w-[4.5rem] min-w-[4.5rem] shrink-0 !py-1.5"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.price ?? ''}
                      onChange={(e) => {
                        const contents = [...(delivery.boxContents ?? [])];
                        if (!contents[i]) contents[i] = [];
                        contents[i] = contents[i].map((it, k) =>
                          k === j ? { ...it, price: parseFloat(e.target.value) || 0 } : it
                        );
                        onChange({ ...delivery, boxContents: contents });
                      }}
                      placeholder="₪"
                      className="input-field w-[5rem] min-w-[5rem] shrink-0 !py-1.5"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const contents = [...(delivery.boxContents ?? [])];
                        if (!contents[i]) contents[i] = [];
                        contents[i] = contents[i].filter((_, k) => k !== j);
                        onChange({ ...delivery, boxContents: contents });
                      }}
                      className="action-btn text-red-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const contents = [...(delivery.boxContents ?? [])];
                    if (!contents[i]) contents[i] = [];
                    contents[i] = [...contents[i], { description: '', qty: 1, price: 0 }];
                    onChange({ ...delivery, boxContents: contents });
                  }}
                  className="text-xs text-indigo-600 hover:underline flex items-center gap-1 font-medium"
                >
                  <Plus className="w-3 h-3" /> Add item
                </button>
              </div>
            ))}
          </div>
          </CollapsibleParcelContent>
        </div>
      )}

      {addr.videoUrl && (
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1">
            <Video className="w-4 h-4" /> Verification video
          </div>
          <video src={addr.videoUrl} controls className="w-full max-w-xs max-h-40 rounded-xl border bg-black" />
        </div>
      )}

      {addr.imageUrl && (
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1">
            <Image className="w-4 h-4" /> Verification photo
          </div>
          <button type="button" onClick={() => setImagePreview(addr.imageUrl)} className="block">
            <img src={addr.imageUrl} alt="Verification" className="max-w-xs max-h-40 rounded-xl border object-contain cursor-zoom-in hover:opacity-90 transition-opacity" />
          </button>
        </div>
      )}

      {imagePreview && (
        <div
          className="modal-overlay z-50 bg-black/70"
          onClick={() => setImagePreview(null)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Escape' && setImagePreview(null)}
        >
          <img src={imagePreview} alt="Enlarged" className="max-w-full max-h-full object-contain rounded-xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

function AffiliatePickerModal({ isOpen, onClose, onSelect }) {
  const [affiliates, setAffiliates] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    fetch(`${API_BASE}/affiliates`).then((r) => r.json()).then((data) => setAffiliates(Array.isArray(data) ? data.filter((a) => a.active !== false) : [])).catch(() => {});
    setSearch('');
  }, [isOpen]);

  if (!isOpen) return null;
  const filtered = affiliates.filter((a) => (a.name || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="modal-overlay z-[70]">
      <div className="modal-content max-w-sm max-h-[70vh]">
        <div className="modal-header">
          <h3 className="font-bold text-slate-800">Select Affiliate</h3>
          <button onClick={onClose} className="action-btn hover:bg-slate-100 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-6 py-3 border-b border-slate-100">
          <input
            autoFocus
            className="input-field"
            placeholder="Search affiliate..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <ul className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filtered.length === 0 && <li className="px-6 py-6 text-center text-sm text-slate-400">No affiliates found</li>}
          {filtered.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onSelect(a); }}
                className="w-full flex items-center gap-3 px-6 py-3 hover:bg-indigo-50/70 text-left transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{a.name}</p>
                  <p className="text-xs text-slate-400">{a.promoCode}{a.discountAmount ? ` · ₪${a.discountAmount} discount` : ''}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function MissionDetails({
  mission,
  onSave,
  onClose,
  onDelete,
  onOpenPreview,
  onSendToLionWheel,
  sendingLwMissionId,
}) {
  const [edit, setEdit] = useState({ ...mission, bringBoxes: mission.bringBoxes === true });
  const [saving, setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState('');
  const [affiliatePickerOpen, setAffiliatePickerOpen] = useState(false);
  const [emptyBoxMissionPickerOpen, setEmptyBoxMissionPickerOpen] = useState(false);
  const [linkedEmptyBoxMission, setLinkedEmptyBoxMission] = useState(null);
  const [linkedPickups, setLinkedPickups] = useState([]);
  const [pickupMissionPickerOpen, setPickupMissionPickerOpen] = useState(false);
  const [pickupPickerDataKey, setPickupPickerDataKey] = useState(0);
  const [linkingPickup, setLinkingPickup] = useState(false);
  const [parcelContentTypes, setParcelContentTypes] = useState([]);

  useEffect(() => {
    setEdit({ ...mission, bringBoxes: mission.bringBoxes === true });
  }, [mission.id]);

  useEffect(() => {
    if (!mission?.id) return;
    setEdit((prev) =>
      prev.id === mission.id ? { ...prev, lionwheel: mission.lionwheel } : prev,
    );
  }, [mission?.lionwheel, mission?.id]);

  const fetchParcelContentTypes = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/parcel-content-types`);
      if (res.ok) setParcelContentTypes(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    fetchParcelContentTypes();
  }, [fetchParcelContentTypes]);

  useEffect(() => {
    if (edit.linkedEmptyBoxMissionId) {
      fetch(`${API_BASE}/missions/${edit.linkedEmptyBoxMissionId}`)
        .then((r) => r.ok ? r.json() : null)
        .then(setLinkedEmptyBoxMission)
        .catch(() => setLinkedEmptyBoxMission(null));
    } else {
      setLinkedEmptyBoxMission(null);
    }
  }, [edit.linkedEmptyBoxMissionId]);

  const refreshLinkedPickups = useCallback(async () => {
    if (edit.type !== 'empty_box' || !edit.id) {
      setLinkedPickups([]);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/missions?type=pickup&linkedEmptyBoxMissionId=${encodeURIComponent(edit.id)}`);
      const data = res.ok ? await res.json() : [];
      setLinkedPickups(Array.isArray(data) ? data : []);
    } catch {
      setLinkedPickups([]);
    }
  }, [edit.type, edit.id]);

  useEffect(() => {
    refreshLinkedPickups();
  }, [refreshLinkedPickups]);

  const isPickup = edit.type === 'pickup';

  useEffect(() => {
    if (!isPickup) setAffiliatePickerOpen(false);
  }, [isPickup]);

  const normalizedDeliveriesForUi = useMemo(() => {
    if (!isPickup) return [];
    if (edit.deliveries?.length > 0) return edit.deliveries;
    return [{
      id: edit.id ? `PKG-${(edit.id || '').replace(/^MSN-/, '')}-0` : undefined,
      receiverName: edit.receiverName || '',
      receiverPhone: edit.receiverPhone || '',
      address: edit.receiverAddress || {},
      boxCount: edit.pickupBoxCount ?? 1,
      boxContents: edit.deliveries?.[0]?.boxContents ?? Array.from({ length: edit.pickupBoxCount ?? 1 }, () => []),
    }];
  }, [isPickup, edit.deliveries, edit.id, edit.receiverName, edit.receiverPhone, edit.receiverAddress, edit.pickupBoxCount]);

  const deliveriesContentTotalIls = useMemo(
    () => sumAllDeliveriesContentsIls(normalizedDeliveriesForUi),
    [normalizedDeliveriesForUi]
  );

  const maxPickupLinksEmptyBox = edit.type === 'empty_box' ? maxPickupLinksForEmptyBox(edit) : 0;
  const emptyPickupSlots =
    edit.type === 'empty_box' ? Math.max(0, maxPickupLinksEmptyBox - linkedPickups.length) : 0;
  const missingAddress = isPickup
    ? (edit.deliveries?.length > 0
        ? edit.deliveries.some((d) => !d.address?.lat)
        : !edit.receiverAddress?.lat)
    : !edit.address?.lat;

  const showSendToLionWheel =
    onSendToLionWheel &&
    edit.createdBy === 'customer' &&
    (edit.type === 'pickup' || edit.type === 'empty_box') &&
    !edit.lionwheel?.taskId;

  const update = (path, value) => {
    if (path.includes('.')) {
      const [parent, key] = path.split('.');
      setEdit((p) => ({ ...p, [parent]: { ...(p[parent] || {}), [key]: value } }));
    } else {
      setEdit((p) => {
        const next = { ...p, [path]: value };
        if (path === 'type' && value !== 'pickup') {
          next.affiliateName = null;
          next.discountAmount = null;
        }
        return next;
      });
    }
  };

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const payload = { ...edit };
      if (payload.deliveries?.length) {
        payload.deliveries = payload.deliveries.map((d, i) => ({
          ...d,
          id: `PKG-${(mission.id || '').replace(/^MSN-/, '')}-${i}`,
        }));
      }
      const res = await fetch(`${API_BASE}/missions/${mission.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Save error');
      const saved = await res.json();
      setEdit({ ...saved, bringBoxes: saved.bringBoxes === true });
      onSave?.(saved);
    } catch (e) {
      setError(e.message || 'Error');
    } finally {
      setSaving(false);
    }
  };

  const handleLinkPickup = async (pickupMission) => {
    if (!pickupMission?.id || !edit.id) return;
    setLinkingPickup(true);
    try {
      const res = await fetch(`${API_BASE}/missions/${pickupMission.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkedEmptyBoxMissionId: edit.id }),
      });
      if (res.ok) {
        await refreshLinkedPickups();
        setPickupPickerDataKey((k) => k + 1);
      } else {
        let msg = 'Could not link pickup';
        try {
          const j = await res.json();
          if (j.error) msg = j.error;
        } catch {}
        setError(msg);
      }
    } catch {
      // silent
    } finally {
      setLinkingPickup(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true); setError('');
    try {
      const res = await fetch(`${API_BASE}/missions/${mission.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete error');
      setShowDeleteConfirm(false);
      onDelete?.();
    } catch (e) {
      setError(e.message || 'Error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">

      {/* Missing address warning */}
      {missingAddress && (
        <div className="flex items-center gap-3 px-4 py-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-500" />
          <div>
            <p className="font-semibold text-sm">
              {isPickup ? 'Missing delivery address' : 'Missing address'}
            </p>
            <p className="text-xs text-amber-700">
              {isPickup
                ? 'Fill in the receiver details and delivery address below after completing the pickup.'
                : 'This mission has no verified address. Fill it in below and save.'}
            </p>
          </div>
        </div>
      )}

      {/* Core fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <EditableField label="ID" value={edit.id} onChange={() => {}} readOnly />
        <div>
          <label className="label">Type</label>
          <select value={edit.type || ''} onChange={(e) => update('type', e.target.value)} className="select-field">
            {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select value={edit.status || 'received'} onChange={(e) => update('status', e.target.value)} className="select-field">
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Customer phone</label>
          <PhoneInput value={edit.customerPhone} onChange={(v) => update('customerPhone', v)} />
        </div>
      </div>

      {/* Sender details */}
      <div className="card p-4 space-y-3">
        <h4 className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
          <User className="w-4 h-4" /> Sender details
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <EditableField label="Full name" value={edit.fullName} onChange={(v) => update('fullName', v)} placeholder="Full name" />
          <div>
            <label className="label">Phone</label>
            <PhoneInput value={edit.customerPhone} onChange={(v) => update('customerPhone', v)} placeholder="501234567" />
          </div>
        </div>
      </div>

      {!isPickup && edit.type === 'empty_box' && (
        <div className="card p-4 space-y-2">
          <h4 className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
            <Globe className="w-4 h-4" /> Ship to (after packing)
          </h4>
          <p className="text-xs text-slate-500">Destination country for the customer&apos;s packed shipment</p>
          <select
            value={missionLwRegionId(edit) || ''}
            onChange={(e) => update('country', e.target.value || null)}
            className="select-field"
          >
            <option value="">— Not set —</option>
            {SHIPPING_DESTINATIONS.map((d) => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Linked pickup missions — empty box only */}
      {!isPickup && edit.type === 'empty_box' && edit.id && (
        <div className="card p-4 border-2 border-dashed border-indigo-200 bg-indigo-50/20 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <label className="label">Linked Pickup Missions</label>
              <p className="text-xs text-slate-500">
                Pickup missions linked to this empty box delivery
                {edit.type === 'empty_box' && (
                  <span className="text-slate-400"> · {linkedPickups.length} / {maxPickupLinksEmptyBox} slots</span>
                )}
              </p>
            </div>
            {emptyPickupSlots > 0 && (
              <button
                type="button"
                disabled={linkingPickup}
                onClick={() => setPickupMissionPickerOpen(true)}
                className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-indigo-200 bg-white text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 transition-all duration-200 disabled:opacity-50 shrink-0"
                title="Link pickup mission"
              >
                <Plus className="w-5 h-5" />
              </button>
            )}
          </div>
          <div className="space-y-2 mt-2">
            {linkedPickups.map((p) => (
              <div key={p.id} className="p-3.5 rounded-xl bg-white border border-slate-200 flex items-center gap-3">
                <Link2 className="w-5 h-5 text-indigo-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{p.fullName || '—'}</p>
                  <p className="text-xs text-slate-500 truncate">{p.address && p.address.displayAddress}</p>
                  <p className="text-xs font-mono text-indigo-600">{p.id}</p>
                </div>
                {onOpenPreview && (
                  <button
                    type="button"
                    onClick={() => onOpenPreview(p)}
                    className="action-btn hover:bg-indigo-50 text-indigo-600"
                    title="Preview"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            {Array.from({ length: emptyPickupSlots }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="p-3.5 rounded-xl border-2 border-dashed border-slate-200 bg-white/60 text-sm text-slate-400"
              >
                No pickup linked
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Link to empty box — pickup only */}
      {isPickup && (
        <div className="card p-4 border-2 border-dashed border-indigo-200 bg-indigo-50/20 space-y-2">
          <label className="label">Link to Empty Box Mission</label>
          <p className="text-xs text-slate-500">Associate this pickup with the empty box delivery</p>
          <button
            type="button"
            onClick={() => setEmptyBoxMissionPickerOpen(true)}
            className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all duration-200 text-left ${
              linkedEmptyBoxMission || edit.linkedEmptyBoxMissionId
                ? 'border-indigo-400 bg-indigo-100'
                : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/50'
            }`}
          >
            <Link2 className="w-5 h-5 text-indigo-600 shrink-0" />
            {linkedEmptyBoxMission ? (
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{linkedEmptyBoxMission.fullName}</p>
                  <p className="text-xs text-slate-500 truncate">{linkedEmptyBoxMission.address && linkedEmptyBoxMission.address.displayAddress}</p>
                  <p className="text-xs font-mono text-indigo-600">{linkedEmptyBoxMission.id}</p>
                </div>
                {onOpenPreview && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onOpenPreview(linkedEmptyBoxMission); }}
                    className="action-btn hover:bg-indigo-50 text-indigo-600 shrink-0"
                    title="Preview"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : edit.linkedEmptyBoxMissionId ? (
              <span className="text-sm text-slate-600 font-mono">{edit.linkedEmptyBoxMissionId}</span>
            ) : (
              <span className="text-sm text-slate-500">Select empty box mission…</span>
            )}
            {(linkedEmptyBoxMission || edit.linkedEmptyBoxMissionId) && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setEdit((p) => ({ ...p, linkedEmptyBoxMissionId: null })); setLinkedEmptyBoxMission(null); }}
                className="text-xs text-red-500 hover:underline font-medium"
              >
                Remove
              </button>
            )}
          </button>
        </div>
      )}

      {/* Pickup / sender address */}
      <AddressBlock
        title={isPickup ? 'Pickup Address' : 'Address'}
        addr={edit.address || {}}
        onChange={(a) => update('address', a)}
      />

      {/* Deliveries — pickup only */}
      {isPickup && (
        <div className="space-y-3">
          <h4 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
            <MapPin className="w-4 h-4 text-indigo-500" />
            {edit.deliveries?.length > 1
              ? `Delivery addresses (${edit.deliveries.length})`
              : 'Delivery address'}
          </h4>
          {normalizedDeliveriesForUi.map((d, idx) => {
            const totalPickup = edit.pickupBoxCount ?? 1;
            const otherAssigned = normalizedDeliveriesForUi.reduce((s, r, i) => (i !== idx ? s + (r.boxCount || 0) : s), 0);
            return (
            <DeliveryEditCard
              key={d.id || idx}
              delivery={d}
              idx={idx}
              totalPickup={totalPickup}
              otherAssigned={otherAssigned}
              parcelContentTypes={parcelContentTypes}
              onChange={(updated) => {
                if (edit.deliveries?.length > 0) {
                  const arr = edit.deliveries.map((r, i) => i === idx ? updated : r);
                  setEdit((p) => ({
                    ...p,
                    deliveries: arr,
                    receiverName: arr[0]?.receiverName || p.receiverName,
                    receiverPhone: arr[0]?.receiverPhone || p.receiverPhone,
                    receiverAddress: arr[0]?.address || p.receiverAddress,
                  }));
                } else {
                  setEdit((p) => ({
                    ...p,
                    deliveries: [updated],
                    receiverName: updated.receiverName,
                    receiverPhone: updated.receiverPhone,
                    receiverAddress: updated.address,
                    pickupBoxCount: updated.boxCount ?? p.pickupBoxCount,
                  }));
                }
              }}
            />
            );
          })}
          {normalizedDeliveriesForUi.length > 0 && (
            <div className="flex justify-end text-sm font-semibold text-slate-800">
              סה״כ תוכן: {formatIls(deliveriesContentTotalIls)}
            </div>
          )}
        </div>
      )}

      {/* Box selection */}
      <div className="card p-4 bg-blue-50/50 border-blue-200 space-y-3">
        {isPickup && (
          <>
            <div>
              <label className="label">Boxes to collect from customer</label>
              <input
                type="number" min="0"
                value={edit.pickupBoxCount ?? ''}
                onChange={(e) => {
                  const count = parseInt(e.target.value) || 0;
                  setEdit((p) => ({ ...p, pickupBoxCount: count }));
                }}
                placeholder="0"
                className="input-field"
              />
            </div>
          </>
        )}
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-blue-800 text-sm">Box types</h4>
          {isPickup && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className="text-xs text-slate-600">Bring boxes to customer</span>
              <div
                role="checkbox"
                aria-checked={edit.bringBoxes !== false}
                tabIndex={0}
                onClick={() => {
                  const next = edit.bringBoxes === false;
                  setEdit((p) => ({
                    ...p,
                    bringBoxes: next,
                    boxSelection: next ? p.boxSelection : { large: 0, small: 0 },
                  }));
                }}
                onKeyDown={(e) => e.key === ' ' && e.currentTarget.click()}
                className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${edit.bringBoxes !== false ? 'bg-indigo-600' : 'bg-slate-300'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${edit.bringBoxes !== false ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </label>
          )}
        </div>

        {(!isPickup || edit.bringBoxes !== false) && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">ISA-BOX-70 (Large)</label>
                <input
                  type="number" min="0"
                  value={edit.boxSelection?.large ?? ''}
                  onChange={(e) => {
                    const large = parseInt(e.target.value) || 0;
                    const small = edit.boxSelection?.small ?? 0;
                    setEdit((p) => ({ ...p, boxSelection: { large, small } }));
                  }}
                  placeholder="0"
                  className="input-field"
                />
              </div>
              <div>
                <label className="label">ISA-BOX-35 (Small)</label>
                <input
                  type="number" min="0"
                  value={edit.boxSelection?.small ?? ''}
                  onChange={(e) => {
                    const small = parseInt(e.target.value) || 0;
                    const large = edit.boxSelection?.large ?? 0;
                    setEdit((p) => ({ ...p, boxSelection: { large, small } }));
                  }}
                  placeholder="0"
                  className="input-field"
                />
              </div>
            </div>
            {((edit.boxSelection?.large || 0) + (edit.boxSelection?.small || 0) > 0) && (
              <p className="text-xs text-blue-600 font-medium">Total: {(edit.boxSelection?.large || 0) + (edit.boxSelection?.small || 0)} boxes</p>
            )}
          </>
        )}

        {isPickup && edit.bringBoxes === false && (
          <p className="text-xs text-slate-500 italic">No boxes — customer has their own</p>
        )}
      </div>

      {/* Affiliate — pickup only */}
      {isPickup && (
      <div className="card p-4 space-y-2">
        <h4 className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
          <Tag className="w-4 h-4" /> Affiliate
        </h4>
        {edit.affiliateName ? (
          <div className="flex items-center justify-between gap-2 p-3.5 bg-indigo-50/60 border border-indigo-200 rounded-xl">
            <div>
              <p className="text-sm font-semibold text-slate-800">{edit.affiliateName}</p>
              {edit.discountAmount && <p className="text-xs text-slate-500">₪{edit.discountAmount} discount</p>}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setAffiliatePickerOpen(true)} className="text-xs text-indigo-600 hover:underline font-medium">Change</button>
              <button type="button" onClick={() => setEdit((p) => ({ ...p, affiliateName: null, discountAmount: null }))} className="text-xs text-red-500 hover:underline font-medium">Remove</button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAffiliatePickerOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-indigo-700 border-2 border-dashed border-indigo-200 hover:bg-indigo-50 rounded-xl transition-colors"
          >
            Assign affiliate
          </button>
        )}
      </div>
      )}

      {/* Notes */}
      <div>
        <label className="label">Notes</label>
        <textarea
          value={edit.notes ?? ''}
          onChange={(e) => update('notes', e.target.value)}
          rows={3}
          placeholder="Notes..."
          className="input-field resize-y"
        />
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="flex flex-wrap gap-3 pt-2 items-center">
        {showSendToLionWheel && (
          <button
            type="button"
            onClick={() => onSendToLionWheel(edit)}
            disabled={saving || sendingLwMissionId === edit.id}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 shadow-sm"
            title="שלח ל-LionWheel"
          >
            <Truck className={`w-4 h-4 ${sendingLwMissionId === edit.id ? 'animate-pulse' : ''}`} />
            Send to LionWheel
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-success"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save changes'}
        </button>
        {onDelete && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={saving}
            className="btn-danger"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        )}
      </div>

      {showDeleteConfirm && (
        <div className="modal-overlay z-50">
          <div className="modal-content max-w-md p-6">
            <h4 className="font-bold text-slate-800 mb-2">Delete mission?</h4>
            <p className="text-slate-600 text-sm mb-4">
              Delete <strong>{mission.id}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowDeleteConfirm(false)} disabled={deleting} className="btn-secondary">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting} className="btn-danger">
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isPickup && (
        <AffiliatePickerModal
          isOpen={affiliatePickerOpen}
          onClose={() => setAffiliatePickerOpen(false)}
          onSelect={(a) => {
            setEdit((p) => ({ ...p, affiliateName: a.name, discountAmount: a.discountAmount }));
            setAffiliatePickerOpen(false);
          }}
        />
      )}

      <EmptyBoxMissionPickerModal
        isOpen={emptyBoxMissionPickerOpen}
        onClose={() => setEmptyBoxMissionPickerOpen(false)}
        onSelect={(m) => {
          setEdit((p) => ({ ...p, linkedEmptyBoxMissionId: m?.id || null }));
          setLinkedEmptyBoxMission(m || null);
          setEmptyBoxMissionPickerOpen(false);
        }}
      />

      <PickupMissionPickerModal
        isOpen={pickupMissionPickerOpen}
        onClose={() => setPickupMissionPickerOpen(false)}
        emptyBoxMissionId={edit.id}
        dataRefreshKey={pickupPickerDataKey}
        onPreviewPickup={
          onOpenPreview
            ? (m) => {
                onOpenPreview(m);
                setPickupMissionPickerOpen(false);
              }
            : undefined
        }
        onLinksChanged={async () => {
          await refreshLinkedPickups();
          setPickupPickerDataKey((k) => k + 1);
        }}
        onSelect={handleLinkPickup}
      />
    </div>
  );
}
