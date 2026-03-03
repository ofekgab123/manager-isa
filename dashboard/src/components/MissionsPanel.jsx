import { useState, useEffect, useRef } from 'react';
import { Plus, X, Box, Truck, ClipboardList, MapPin, Copy, Image, Video, LocateFixed, User, Phone, Upload } from 'lucide-react';
import { API_BASE } from '../config';
import AddressPicker from './AddressPicker';

const MISSION_TYPE_LABELS = {
  ready_for_box: 'Ready for Box',
  ready_for_pickup: 'Ready for Pickup',
};

const MISSION_TYPE_STYLES = {
  ready_for_box: 'bg-blue-100 text-blue-700 border-blue-200',
  ready_for_pickup: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const MISSION_TYPE_ICONS = {
  ready_for_box: Box,
  ready_for_pickup: Truck,
};

const STATUS_OPTIONS = [
  { value: 'received', label: 'Received' },
  { value: 'linewhel_transferred', label: 'Transferred to Linewhel' },
  { value: 'linewhel_scheduled', label: 'Linewhel Scheduled' },
  { value: 'collected', label: 'Collected' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'completed', label: 'Completed' },
];

const STATUS_STYLES = {
  received: 'bg-amber-100 text-amber-700 border-amber-200',
  linewhel_transferred: 'bg-blue-100 text-blue-700 border-blue-200',
  linewhel_scheduled: 'bg-purple-100 text-purple-700 border-purple-200',
  collected: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  shipped: 'bg-orange-100 text-orange-700 border-orange-200',
  completed: 'bg-green-100 text-green-700 border-green-200',
};

function getOrderCustomerDetails(order) {
  const isPickup = order.type === 'pickup' || order.type === 'send';
  const name = order.fullName || [order.firstName, order.lastName].filter(Boolean).join(' ') || '';
  const phone = order.customerPhone || '';
  if (isPickup) {
    return {
      name,
      phone,
      senderName: name,
      senderPhone: phone,
      receiverName: order.receiverName || '',
      receiverPhone: order.receiverPhone || '',
    };
  }
  // empty_box — pre-fill sender from order customer; receiver left blank
  return {
    name,
    phone,
    senderName: name,
    senderPhone: phone,
    receiverName: '',
    receiverPhone: '',
  };
}


/* ─── Add Mission Modal ─────────────────────────────────────── */
function AddMissionModal({ order, onClose, onSaved }) {
  const isPickup = order.type === 'pickup' || order.type === 'send';

  const defaultPickup = order.senderAddress?.displayAddress
    ? order.senderAddress
    : (order.address?.displayAddress ? order.address : null);
  const defaultDelivery = order.receiverAddress?.displayAddress ? order.receiverAddress : null;
  const defaultAddress = (!isPickup && order.address?.displayAddress) ? order.address : null;

  const [selectedType, setSelectedType] = useState('ready_for_box');
  const [selectedStatus, setSelectedStatus] = useState('received');
  const [notes, setNotes] = useState('');
  const [largeBoxes, setLargeBoxes] = useState('');
  const [smallBoxes, setSmallBoxes] = useState('');
  const [pickupLocation, setPickupLocation] = useState(null);
  const [deliveryLocation, setDeliveryLocation] = useState(null);
  const [activeLocationPicker, setActiveLocationPicker] = useState(null); // 'pickup' | 'delivery' | 'custom-{i}'
  const [customAddresses, setCustomAddresses] = useState(
    defaultAddress ? [{ label: 'Order address', ...defaultAddress }] : []
  );
  const [customerDetails, setCustomerDetails] = useState(() => getOrderCustomerDetails(order));
  const [missionImageUrl, setMissionImageUrl] = useState(order.imageUrl || null);
  const [saving, setSaving] = useState(false);
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const canvas = document.createElement('canvas');
    const img = document.createElement('img');
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1200;
      const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      setMissionImageUrl(canvas.toDataURL('image/jpeg', 0.75));
      URL.revokeObjectURL(url);
    };
    img.src = url;
    e.target.value = '';
  };

  // When switching to ready_for_pickup, pre-fill locations from order
  useEffect(() => {
    if (selectedType === 'ready_for_pickup') {
      setPickupLocation((prev) => prev || defaultPickup);
      setDeliveryLocation((prev) => prev || defaultDelivery);
    } else {
      setPickupLocation(null);
      setDeliveryLocation(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType]);

  const updateCustomer = (field, value) =>
    setCustomerDetails((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const addresses = [...customAddresses];
      const res = await fetch(`${API_BASE}/orders/${order.id}/missions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedType,
          status: selectedStatus,
          notes,
          addresses,
          customerDetails,
          pickupLocation: selectedType === 'ready_for_pickup' ? pickupLocation : null,
          deliveryLocation: selectedType === 'ready_for_pickup' ? deliveryLocation : null,
          imageUrl: missionImageUrl || null,
          largeBoxes: selectedType === 'ready_for_box' ? (parseInt(largeBoxes) || 0) : null,
          smallBoxes: selectedType === 'ready_for_box' ? (parseInt(smallBoxes) || 0) : null,
        }),
      });
      if (res.ok) { onSaved(); onClose(); }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-indigo-600" />
              New Mission — {order.id}
            </h2>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

            {/* Customer details */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                Customer details
              </p>
              {selectedType === 'ready_for_pickup' ? (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'senderName', label: 'Sender name', type: 'text' },
                    { key: 'senderPhone', label: 'Sender phone', type: 'tel' },
                    { key: 'receiverName', label: 'Receiver name', type: 'text' },
                    { key: 'receiverPhone', label: 'Receiver phone', type: 'tel' },
                  ].map(({ key, label, type }) => (
                    <div key={key}>
                      <label className="block text-xs text-slate-400 mb-0.5">{label}</label>
                      <input
                        type={type}
                        value={customerDetails[key] || ''}
                        onChange={(e) => updateCustomer(key, e.target.value)}
                        placeholder={key.startsWith('receiver') ? 'Fill in...' : ''}
                        className={`w-full px-2.5 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 ${
                          key.startsWith('receiver') && !customerDetails[key]
                            ? 'border-amber-300 bg-amber-50 placeholder-amber-400'
                            : 'border-slate-200'
                        }`}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-slate-400 mb-0.5">Name</label>
                    <input
                      type="text"
                      value={customerDetails.name || ''}
                      onChange={(e) => updateCustomer('name', e.target.value)}
                      className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-0.5">Phone</label>
                    <input
                      type="tel"
                      value={customerDetails.phone || ''}
                      onChange={(e) => updateCustomer('phone', e.target.value)}
                      className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Type */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Mission type</label>
              <div className="flex gap-2">
                {Object.entries(MISSION_TYPE_LABELS).map(([value, label]) => {
                  const Icon = MISSION_TYPE_ICONS[value];
                  return (
                    <button
                      key={value}
                      onClick={() => setSelectedType(value)}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                        selectedType === value
                          ? MISSION_TYPE_STYLES[value] + ' ring-2 ring-offset-1 ring-current'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mission image */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Mission image</label>
              <div className="space-y-2">

                {/* Current mission image preview */}
                {missionImageUrl && (
                  <div className="relative rounded-xl border border-indigo-200 overflow-hidden">
                    <div className="relative group">
                      <img src={missionImageUrl} alt="Mission" className="w-full max-h-48 object-cover" />
                      <button type="button" onClick={() => setImagePreview(missionImageUrl)}
                        className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 px-3 py-1.5 bg-white/90 rounded-lg text-sm font-medium text-slate-800 shadow">
                          <Image className="w-4 h-4" />Enlarge
                        </span>
                      </button>
                    </div>
                    <button type="button" onClick={() => setMissionImageUrl(order.imageUrl || null)}
                      className="absolute top-2 right-2 p-1 bg-white/80 hover:bg-white rounded-full text-slate-500 hover:text-red-500 shadow transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Buttons row */}
                <div className="flex gap-2 flex-wrap">
                  {/* Upload new image */}
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-2 border border-dashed border-indigo-300 rounded-lg text-sm text-indigo-600 hover:bg-indigo-50 transition-colors">
                    <Upload className="w-4 h-4" />
                    Upload image
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

                  {/* Use order image (if exists and different from current) */}
                  {order.imageUrl && missionImageUrl !== order.imageUrl && (
                    <button type="button" onClick={() => setMissionImageUrl(order.imageUrl)}
                      className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                      <Image className="w-4 h-4" />
                      Use order image
                    </button>
                  )}
                </div>

              </div>
            </div>

            {/* Pickup & Delivery locations — only for ready_for_pickup */}
            {selectedType === 'ready_for_pickup' && (
              <div className="space-y-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <p className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5" />
                  Pickup & Delivery locations
                </p>
                {[
                  { label: 'Pickup location', loc: pickupLocation, setLoc: setPickupLocation, picker: 'pickup' },
                  { label: 'Delivery location', loc: deliveryLocation, setLoc: setDeliveryLocation, picker: 'delivery' },
                ].map(({ label, loc, setLoc, picker }) => (
                  <div key={picker}>
                    <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
                    {loc?.displayAddress ? (
                      <div className="flex items-start gap-2 px-3 py-2 bg-white border border-emerald-200 rounded-lg">
                        <MapPin className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="text-xs text-slate-700">{loc.displayAddress}</p>
                          {loc.lat != null && (
                            <p className="text-xs font-mono text-slate-400">
                              {Number(loc.lat).toFixed(6)}, {Number(loc.lng).toFixed(6)}
                            </p>
                          )}
                          {loc.imageUrl && (
                            <button type="button" onClick={() => setImagePreview(loc.imageUrl)}
                              className="flex items-center gap-1 text-xs text-indigo-600 hover:underline">
                              <Image className="w-3.5 h-3.5" />View photo
                            </button>
                          )}
                        </div>
                        <button type="button" onClick={() => setActiveLocationPicker(picker)}
                          className="flex-shrink-0 p-1 rounded hover:bg-emerald-100 text-emerald-600 hover:text-emerald-800 transition-colors" title="Change location">
                          <LocateFixed className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => setLoc(null)}
                          className="flex-shrink-0 text-slate-300 hover:text-red-500 transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setActiveLocationPicker(picker)}
                        className="flex items-center gap-1.5 px-3 py-2 border border-dashed border-emerald-300 rounded-lg text-sm text-emerald-700 hover:bg-emerald-100 transition-colors w-full">
                        <LocateFixed className="w-4 h-4" />
                        Pick {picker} location on map
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Custom address */}
            {selectedType !== 'ready_for_pickup' && <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Custom address</label>
              {customAddresses.length > 0 && (
                <div className="space-y-1.5 mb-2">
                  {customAddresses.map((addr, i) => (
                    <div key={i} className="flex items-start gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg">
                      <MapPin className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-slate-700 truncate">{addr.displayAddress}</p>
                        {addr.lat != null && addr.lng != null && (
                          <p className="text-xs font-mono text-slate-400">
                            {Number(addr.lat).toFixed(6)}, {Number(addr.lng).toFixed(6)}
                          </p>
                        )}
                        {(addr.imageUrl || addr.videoUrl) && (
                          <div className="flex gap-2 mt-1 flex-wrap">
                            {addr.imageUrl && (
                              <button type="button" onClick={() => setImagePreview(addr.imageUrl)}
                                className="flex items-center gap-1 text-xs text-indigo-600 hover:underline">
                                <Image className="w-3.5 h-3.5" />Photo
                              </button>
                            )}
                            {addr.videoUrl && (
                              <span className="flex items-center gap-1 text-xs text-slate-400">
                                <Video className="w-3.5 h-3.5" />Video attached
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <button type="button" onClick={() => setCustomAddresses((p) => p.filter((_, j) => j !== i))}
                        className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowAddressPicker(true)}
                className="flex items-center gap-1.5 px-3 py-2 border border-dashed border-indigo-300 rounded-lg text-sm text-indigo-600 hover:bg-indigo-50 hover:border-indigo-400 transition-colors"
              >
                <LocateFixed className="w-4 h-4" />
                Pick address on map
              </button>
            </div>}

            {/* Box quantities — only for ready_for_box */}
            {selectedType === 'ready_for_box' && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
                <p className="text-xs font-semibold text-blue-800 flex items-center gap-1.5">
                  <Box className="w-3.5 h-3.5" />
                  Quantity
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">ISA-BOX-70 (Large)</label>
                    <input
                      type="number"
                      min="0"
                      value={largeBoxes}
                      onChange={(e) => setLargeBoxes(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">ISA-BOX-35 (Small)</label>
                    <input
                      type="number"
                      min="0"
                      value={smallBoxes}
                      onChange={(e) => setSmallBoxes(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Notes (optional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add a note..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-2 px-5 py-4 border-t flex-shrink-0">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Mission'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Address picker — custom addresses */}
      <AddressPicker
        isOpen={showAddressPicker}
        onClose={() => setShowAddressPicker(false)}
        onSelect={(addr) => { setCustomAddresses((p) => [...p, { label: 'Custom location', ...addr }]); setShowAddressPicker(false); }}
      />

      {/* Address picker — pickup / delivery locations */}
      <AddressPicker
        isOpen={activeLocationPicker !== null}
        onClose={() => setActiveLocationPicker(null)}
        onSelect={(addr) => {
          if (activeLocationPicker === 'pickup') setPickupLocation(addr);
          else setDeliveryLocation(addr);
          setActiveLocationPicker(null);
        }}
      />

      {/* Image lightbox */}
      {imagePreview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4"
          onClick={() => setImagePreview(null)}>
          <img src={imagePreview} alt="Enlarged"
            className="max-w-full max-h-full object-contain rounded-xl"
            onClick={(e) => e.stopPropagation()} />
          <button onClick={() => setImagePreview(null)}
            className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </>
  );
}

/* ─── Location cell (reusable for table) ────────────────────── */
function LocationCell({ loc, label, onImageClick, onEdit }) {
  if (!loc?.displayAddress) return <span className="text-slate-300 text-xs">—</span>;
  return (
    <div className="space-y-1 text-xs">
      <div className="flex items-start gap-1">
        <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          {label && <span className="font-semibold text-slate-500 mr-1">{label}:</span>}
          <span className="text-slate-700 break-words">{loc.displayAddress}</span>
        </div>
        {onEdit && (
          <button type="button" onClick={onEdit}
            className="flex-shrink-0 p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors" title="Change location">
            <LocateFixed className="w-3 h-3" />
          </button>
        )}
      </div>
      {loc.lat != null && loc.lng != null && (
        <div className="flex items-center gap-1 pl-4">
          <code className="font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
            {Number(loc.lat).toFixed(5)}, {Number(loc.lng).toFixed(5)}
          </code>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(`${loc.lat}, ${loc.lng}`)}
            className="p-0.5 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600"
            title="Copy"
          >
            <Copy className="w-3 h-3" />
          </button>
        </div>
      )}
      {loc.imageUrl && (
        <div className="pl-4">
          <button type="button" onClick={() => onImageClick(loc.imageUrl)}>
            <img src={loc.imageUrl} alt="Verification"
              className="max-h-16 rounded border object-contain cursor-zoom-in hover:opacity-90" />
          </button>
        </div>
      )}
      {loc.videoUrl && (
        <div className="pl-4">
          <video src={loc.videoUrl} controls className="max-h-16 max-w-[160px] rounded border bg-black" />
        </div>
      )}
    </div>
  );
}

/* ─── Missions Panel (list only) ────────────────────────────── */
export default function MissionsPanel({ order, onUpdated, openForm = false, onFormOpened }) {
  const missions = Array.isArray(order.missions) ? order.missions : [];
  const [showModal, setShowModal] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  // { missionId, field: 'pickupLocation'|'deliveryLocation'|number (addr index) }
  const [editingLocation, setEditingLocation] = useState(null);

  useEffect(() => {
    if (openForm) {
      setShowModal(true);
      onFormOpened?.();
    }
  }, [openForm]);

  const handleStatusChange = async (mission, newStatus) => {
    setUpdatingId(mission.id);
    try {
      const res = await fetch(`${API_BASE}/orders/${order.id}/missions/${mission.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) onUpdated();
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (missionId) => {
    setDeletingId(missionId);
    try {
      const res = await fetch(`${API_BASE}/orders/${order.id}/missions/${missionId}`, { method: 'DELETE' });
      if (res.ok) onUpdated();
    } finally {
      setDeletingId(null);
    }
  };

  const handleEditLocation = async (newAddr) => {
    if (!editingLocation) return;
    const { missionId, field } = editingLocation;
    const mission = missions.find((m) => m.id === missionId);
    if (!mission) { setEditingLocation(null); return; }

    let patch = {};
    if (field === 'pickupLocation') patch = { pickupLocation: newAddr };
    else if (field === 'deliveryLocation') patch = { deliveryLocation: newAddr };
    else if (typeof field === 'number') {
      const addrs = Array.isArray(mission.addresses) ? [...mission.addresses] : [];
      addrs[field] = { ...addrs[field], ...newAddr };
      patch = { addresses: addrs };
    }
    await fetch(`${API_BASE}/orders/${order.id}/missions/${missionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    setEditingLocation(null);
    onUpdated();
  };

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-indigo-600" />
          Missions
          {missions.length > 0 && (
            <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-bold">
              {missions.length}
            </span>
          )}
        </h3>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Mission
        </button>
      </div>

      {/* Table */}
      {missions.length === 0 ? (
        <div className="text-center py-10 text-slate-400">
          <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No missions yet — press <strong>Add Mission</strong> to create one.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <th className="px-3 py-2.5 text-left">Type</th>
                <th className="px-3 py-2.5 text-left">Status</th>
                <th className="px-3 py-2.5 text-left">Customer</th>
                <th className="px-3 py-2.5 text-left">Pickup location</th>
                <th className="px-3 py-2.5 text-left">Delivery location</th>
                <th className="px-3 py-2.5 text-left">Addresses</th>
                <th className="px-3 py-2.5 text-left">Image</th>
                <th className="px-3 py-2.5 text-left">Notes</th>
                <th className="px-3 py-2.5 text-left">Created</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {missions.map((mission, idx) => {
                const TypeIcon = MISSION_TYPE_ICONS[mission.type] || ClipboardList;
                const currentStatus = mission.status || 'received';
                const cd = mission.customerDetails;
                const addrList = Array.isArray(mission.addresses) && mission.addresses.length > 0
                  ? mission.addresses
                  : mission.address?.displayAddress
                    ? [{ label: mission.addressLabel, ...mission.address }]
                    : [];

                return (
                  <tr key={mission.id} className={`border-b border-slate-100 align-top ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>

                    {/* Type */}
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-semibold whitespace-nowrap ${MISSION_TYPE_STYLES[mission.type] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        <TypeIcon className="w-3.5 h-3.5" />
                        {MISSION_TYPE_LABELS[mission.type] || mission.type}
                      </span>
                      {mission.type === 'ready_for_box' && (mission.largeBoxes > 0 || mission.smallBoxes > 0) && (
                        <div className="mt-1 flex flex-col gap-0.5 text-xs text-slate-500">
                          {mission.largeBoxes > 0 && <span>ISA-BOX-70: {mission.largeBoxes}</span>}
                          {mission.smallBoxes > 0 && <span>ISA-BOX-35: {mission.smallBoxes}</span>}
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-3 py-3">
                      <select
                        value={currentStatus}
                        onChange={(e) => handleStatusChange(mission, e.target.value)}
                        disabled={updatingId === mission.id}
                        className={`px-2 py-1 rounded-lg border text-xs font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-50 ${STATUS_STYLES[currentStatus] || 'bg-slate-100 text-slate-600 border-slate-200'}`}
                      >
                        {STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </td>

                    {/* Customer */}
                    <td className="px-3 py-3 min-w-[140px]">
                      {cd ? (
                        <div className="space-y-0.5 text-xs text-slate-700">
                          {cd.senderName && <div className="flex items-center gap-1"><User className="w-3 h-3 text-slate-400 flex-shrink-0" /><span className="font-medium text-slate-400">Sender:</span> {cd.senderName}</div>}
                          {cd.senderPhone && <div className="flex items-center gap-1"><Phone className="w-3 h-3 text-slate-400 flex-shrink-0" />{cd.senderPhone}</div>}
                          {cd.receiverName && <div className="flex items-center gap-1 mt-1"><User className="w-3 h-3 text-slate-400 flex-shrink-0" /><span className="font-medium text-slate-400">Receiver:</span> {cd.receiverName}</div>}
                          {cd.receiverPhone && <div className="flex items-center gap-1"><Phone className="w-3 h-3 text-slate-400 flex-shrink-0" />{cd.receiverPhone}</div>}
                          {cd.name && <div className="flex items-center gap-1"><User className="w-3 h-3 text-slate-400 flex-shrink-0" />{cd.name}</div>}
                          {cd.phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3 text-slate-400 flex-shrink-0" />{cd.phone}</div>}
                        </div>
                      ) : <span className="text-slate-300 text-xs">—</span>}
                    </td>

                    {/* Pickup location */}
                    <td className="px-3 py-3 min-w-[160px]">
                      <LocationCell loc={mission.pickupLocation} onImageClick={setImagePreview}
                        onEdit={() => setEditingLocation({ missionId: mission.id, field: 'pickupLocation' })} />
                    </td>

                    {/* Delivery location */}
                    <td className="px-3 py-3 min-w-[160px]">
                      <LocationCell loc={mission.deliveryLocation} onImageClick={setImagePreview}
                        onEdit={() => setEditingLocation({ missionId: mission.id, field: 'deliveryLocation' })} />
                    </td>

                    {/* Addresses from order */}
                    <td className="px-3 py-3 min-w-[160px]">
                      {addrList.length === 0 ? (
                        <span className="text-slate-300 text-xs">—</span>
                      ) : (
                        <div className="space-y-1.5">
                          {addrList.map((addr, i) => (
                            <LocationCell key={i} loc={addr} label={addr.label} onImageClick={setImagePreview}
                              onEdit={() => setEditingLocation({ missionId: mission.id, field: i })} />
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Image */}
                    <td className="px-3 py-3">
                      {mission.imageUrl ? (
                        <button type="button" onClick={() => setImagePreview(mission.imageUrl)}
                          className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 hover:opacity-80 transition-opacity flex-shrink-0">
                          <img src={mission.imageUrl} alt="Mission" className="w-full h-full object-cover" />
                        </button>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>

                    {/* Notes */}
                    <td className="px-3 py-3 max-w-[140px]">
                      {mission.notes
                        ? <span className="text-xs text-slate-600 break-words">{mission.notes}</span>
                        : <span className="text-slate-300 text-xs">—</span>}
                    </td>

                    {/* Created */}
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className="text-xs text-slate-400">
                        {new Date(mission.createdAt).toLocaleString('en-US', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>

                    {/* Delete */}
                    <td className="px-3 py-3">
                      <button
                        onClick={() => handleDelete(mission.id)}
                        disabled={deletingId === mission.id}
                        className="text-slate-300 hover:text-red-500 disabled:opacity-50 transition-colors"
                        title="Delete"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Mission Modal */}
      {showModal && (
        <AddMissionModal
          order={order}
          onClose={() => setShowModal(false)}
          onSaved={() => { onUpdated(); setShowModal(false); }}
        />
      )}

      {/* Edit location picker */}
      {editingLocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-indigo-500" />
                Change location
              </h3>
              <button onClick={() => setEditingLocation(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="h-[400px]">
              <AddressPicker onAddressSelected={handleEditLocation} />
            </div>
          </div>
        </div>
      )}

      {/* Image lightbox */}
      {imagePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={() => setImagePreview(null)}>
          <img src={imagePreview} alt="Enlarged"
            className="max-w-full max-h-full object-contain rounded-xl"
            onClick={(e) => e.stopPropagation()} />
          <button onClick={() => setImagePreview(null)}
            className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
