import { useState } from 'react';
import { MapPin, User, Save, X, Video, Image, Copy, Trash2 } from 'lucide-react';
import AddressSearch from './AddressSearch';
import { API_BASE } from '../config';

const STATUS_OPTIONS = [
  { value: 'received', label: 'Received' },
  { value: 'linewhel_transferred', label: 'Transferred to Linewhel' },
  { value: 'linewhel_scheduled', label: 'Linewhel scheduled' },
  { value: 'collected', label: 'Collected' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'completed', label: 'Completed' },
];

const TYPE_OPTIONS = [
  { value: 'pickup', label: 'Pick up' },
  { value: 'empty_box', label: 'Box' },
];

function EditableField({ label, value, onChange, type = 'text', placeholder, readOnly }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className={`w-full px-3 py-2 border rounded-lg text-sm ${readOnly ? 'bg-slate-100' : ''}`}
      />
    </div>
  );
}

function AddressBlock({ title, addr, onChange }) {
  const [showSearch, setShowSearch] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const data = addr || {};
  return (
    <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3">
      <h4 className="font-semibold text-slate-800 flex items-center gap-2">
        <MapPin className="w-4 h-4" />
        {title}
      </h4>
      {showSearch ? (
        <AddressSearch
          value={data.displayAddress ? { displayAddress: data.displayAddress, lat: data.lat, lng: data.lng, city: data.city, street: data.street, houseNumber: data.houseNumber } : null}
          onChange={(a) => {
            if (a) onChange({ ...data, displayAddress: a.displayAddress, lat: a.lat, lng: a.lng, city: a.city, street: a.street, houseNumber: a.houseNumber });
            setShowSearch(false);
          }}
          onClear={() => setShowSearch(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowSearch(true)}
          className="text-sm text-blue-600 hover:underline"
        >
          {data.displayAddress ? 'Change address' : 'Select address'}
        </button>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <EditableField label="City" value={data.city} onChange={(v) => onChange({ ...data, city: v })} />
        <EditableField label="Street" value={data.street} onChange={(v) => onChange({ ...data, street: v })} />
        <EditableField label="House no." value={data.houseNumber} onChange={(v) => onChange({ ...data, houseNumber: v })} />
        <EditableField label="Apartment" value={data.apartment} onChange={(v) => onChange({ ...data, apartment: v })} />
        <EditableField label="Floor" value={data.floor} onChange={(v) => onChange({ ...data, floor: v })} />
      </div>
      {data.displayAddress && (
        <p className="text-sm text-slate-600">Full address: {data.displayAddress}</p>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-slate-500">Exact pin location (lat, lng):</span>
        {(data.lat != null && data.lng != null && String(data.lat).trim() !== '' && String(data.lng).trim() !== '') ? (
          <>
            <code className="text-sm font-mono bg-slate-100 px-2 py-1 rounded">
              {typeof data.lat === 'number' ? data.lat.toFixed(6) : data.lat}, {typeof data.lng === 'number' ? data.lng.toFixed(6) : data.lng}
            </code>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(`${data.lat}, ${data.lng}`)}
              className="p-1.5 hover:bg-slate-200 rounded"
              title="Copy coordinates"
            >
              <Copy className="w-4 h-4 text-slate-500" />
            </button>
          </>
        ) : (
          <span className="text-sm text-slate-400 italic">Not available — use &quot;Change address&quot; and pick on map</span>
        )}
      </div>
      {data.videoUrl && (
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1">
            <Video className="w-4 h-4" />
            Verification video
          </div>
          <video src={data.videoUrl} controls className="w-full max-w-xs max-h-40 rounded-lg border bg-black" />
        </div>
      )}
      {data.imageUrl && (
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1">
            <Image className="w-4 h-4" />
            Verification photo (click to enlarge)
          </div>
          <button
            type="button"
            onClick={() => setImagePreview(data.imageUrl)}
            className="block text-left"
          >
            <img src={data.imageUrl} alt="Address verification" className="max-w-xs max-h-40 rounded-lg border object-contain cursor-zoom-in hover:opacity-90" />
          </button>
        </div>
      )}
      {imagePreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setImagePreview(null)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Escape' && setImagePreview(null)}
        >
          <img
            src={imagePreview}
            alt="Enlarged verification"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

export default function OrderDetails({ order, onSave, onClose, onDelete }) {
  const [edit, setEdit] = useState({ ...order });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState('');

  const update = (path, value) => {
    if (path.includes('.')) {
      const [parent, key] = path.split('.');
      setEdit((p) => ({ ...p, [parent]: { ...(p[parent] || {}), [key]: value } }));
    } else {
      setEdit((p) => ({ ...p, [path]: value }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(edit),
      });
      if (!res.ok) throw new Error('Save error');
      onSave?.(await res.json());
    } catch (e) {
      setError(e.message || 'Error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/orders/${order.id}`, { method: 'DELETE' });
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
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-800">Order details – Edit</h3>
        {onClose && (
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <EditableField label="ID" value={edit.id} onChange={() => {}} readOnly />
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Ready for</label>
          <select
            value={edit.type || ''}
            onChange={(e) => update('type', e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm"
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
          <select
            value={edit.status || ''}
            onChange={(e) => update('status', e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <EditableField label="Boxes" value={edit.boxes} onChange={(v) => update('boxes', parseInt(v) || 0)} type="number" />
        <EditableField label="Customer phone" value={edit.customerPhone} onChange={(v) => update('customerPhone', v)} type="tel" />
        <EditableField label="Scheduled for" value={edit.scheduledFor} onChange={(v) => update('scheduledFor', v)} />
        <EditableField label="Assigned to" value={edit.assignedTo} onChange={(v) => update('assignedTo', v)} />
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Contacted</label>
          <select
            value={edit.contacted ? 'yes' : 'no'}
            onChange={(e) => update('contacted', e.target.value === 'yes')}
            className="w-full px-3 py-2 border rounded-lg text-sm"
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
        {(edit.type === 'pickup' || edit.readyAction) && (
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Action</label>
            <select
              value={edit.readyAction || ''}
              onChange={(e) => update('readyAction', e.target.value || null)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">—</option>
              <option value="ready_for_box">Box</option>
              <option value="pickup">Pick up</option>
            </select>
          </div>
        )}
      </div>

      {/* Personal details - Order empty box */}
      {(edit.type === 'empty_box' || edit.firstName || edit.lastName) && (
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
          <h4 className="font-semibold text-slate-800 flex items-center gap-2">
            <User className="w-4 h-4" />
            Personal details
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <EditableField label="First name" value={edit.firstName} onChange={(v) => update('firstName', v)} />
            <EditableField label="Last name" value={edit.lastName} onChange={(v) => update('lastName', v)} />
          </div>
        </div>
      )}

      {/* Main address */}
      {(edit.address || edit.type === 'empty_box') && (
        <AddressBlock
          title="Address"
          addr={edit.address || {}}
          onChange={(a) => update('address', a)}
        />
      )}

      {/* Sender details - Pick up my parcel (includes legacy type 'send') */}
      {((edit.type === 'pickup' || edit.type === 'send') && (edit.senderAddress || edit.fullName)) && (
        <>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <h4 className="font-semibold text-slate-800 flex items-center gap-2">
              <User className="w-4 h-4" />
              Sender details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <EditableField label="Full name" value={edit.fullName} onChange={(v) => update('fullName', v)} />
            <EditableField label="Israeli phone" value={edit.customerPhone} onChange={(v) => update('customerPhone', v)} type="tel" />
            </div>
          </div>
          <AddressBlock
            title="Pickup address"
            addr={edit.senderAddress || {}}
            onChange={(a) => update('senderAddress', a)}
          />
        </>
      )}

      {/* Receiver details */}
      {((edit.type === 'pickup' || edit.type === 'send') && (edit.receiverName || edit.receiverAddress)) && (
        <>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <h4 className="font-semibold text-slate-800 flex items-center gap-2">
              <User className="w-4 h-4" />
              Receiver details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <EditableField label="Name" value={edit.receiverName} onChange={(v) => update('receiverName', v)} />
            <EditableField label="Phone" value={edit.receiverPhone} onChange={(v) => update('receiverPhone', v)} type="tel" />
            </div>
          </div>
          <AddressBlock
            title="Delivery address"
            addr={edit.receiverAddress || {}}
            onChange={(a) => update('receiverAddress', a)}
          />
        </>
      )}

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
        <textarea
          value={edit.orderNotes ?? ''}
          onChange={(e) => update('orderNotes', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border rounded-lg text-sm"
        />
      </div>

      {/* Items - read only */}
      {edit.items?.length > 0 && (
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <h4 className="font-semibold text-slate-800 mb-2">Items</h4>
          <ul className="text-sm space-y-1">
            {edit.items.map((item) => (
              <li key={item.id}>
                {item.name} × {item.quantity} — ₪{item.price * item.quantity}
              </li>
            ))}
          </ul>
          {edit.totalPrice != null && (
            <p className="font-bold mt-2">Total: ₪{edit.totalPrice}</p>
          )}
        </div>
      )}

      {error && <p className="text-red-500 text-sm">{error}</p>}
      <div className="flex flex-wrap gap-2 pt-2 justify-between">
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save changes'}
          </button>
          {onDelete && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Delete order
            </button>
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <h4 className="font-bold text-slate-800 mb-2">Delete order?</h4>
            <p className="text-slate-600 text-sm mb-4">
              Are you sure you want to delete order <strong>{order.id}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
