import { useState } from 'react';
import { MapPin, User, Save, Trash2, AlertTriangle, Copy, Video, Image } from 'lucide-react';
import AddressPicker from './AddressPicker';
import PhoneInput from './PhoneInput';
import { API_BASE } from '../config';

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
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 ${readOnly ? 'bg-slate-100 text-slate-500' : ''}`}
      />
    </div>
  );
}

function AddressBlock({ addr, onChange, title = 'Address', missing = false }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const data = addr || {};
  return (
    <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3">
      <h4 className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
        <MapPin className="w-4 h-4" />
        {title}
        {missing && (
          <span className="ml-auto text-xs font-semibold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Missing
          </span>
        )}
      </h4>
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="w-full flex items-center gap-2 px-3 py-2.5 border-2 border-dashed border-slate-300 rounded-lg text-sm hover:border-indigo-400 hover:bg-indigo-50 transition-colors text-slate-500 hover:text-indigo-600"
      >
        <MapPin className="w-4 h-4 flex-shrink-0" />
        <span className="truncate">{data.displayAddress || 'Pick location on map…'}</span>
      </button>
      {data.displayAddress && (
        <button type="button" onClick={() => onChange({})} className="text-xs text-red-500 hover:underline -mt-1">
          Clear address
        </button>
      )}
      <AddressPicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(a) => {
          onChange({ ...data, displayAddress: a.displayAddress, lat: a.lat, lng: a.lng, city: a.city, street: a.street, houseNumber: a.houseNumber });
          setPickerOpen(false);
        }}
        initialPosition={data.lat != null ? [data.lat, data.lng] : undefined}
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
            <code className="text-sm font-mono bg-slate-100 px-2 py-1 rounded">
              {typeof data.lat === 'number' ? data.lat.toFixed(6) : data.lat}, {typeof data.lng === 'number' ? data.lng.toFixed(6) : data.lng}
            </code>
            <button type="button" onClick={() => navigator.clipboard?.writeText(`${data.lat}, ${data.lng}`)} className="p-1.5 hover:bg-slate-200 rounded" title="Copy">
              <Copy className="w-4 h-4 text-slate-500" />
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
          <video src={data.videoUrl} controls className="w-full max-w-xs max-h-40 rounded-lg border bg-black" />
        </div>
      )}
      {data.imageUrl && (
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1">
            <Image className="w-4 h-4" /> Verification photo
          </div>
          <button type="button" onClick={() => setImagePreview(data.imageUrl)} className="block">
            <img src={data.imageUrl} alt="Verification" className="max-w-xs max-h-40 rounded-lg border object-contain cursor-zoom-in hover:opacity-90" />
          </button>
        </div>
      )}
      {imagePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setImagePreview(null)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Escape' && setImagePreview(null)}>
          <img src={imagePreview} alt="Enlarged" className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

export default function MissionDetails({ mission, onSave, onClose, onDelete }) {
  const [edit, setEdit] = useState({ ...mission });
  const [saving, setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState('');

  const isPickup = edit.type === 'pickup';
  const missingAddress = isPickup ? !edit.receiverAddress?.lat : !edit.address?.lat;

  const update = (path, value) => {
    if (path.includes('.')) {
      const [parent, key] = path.split('.');
      setEdit((p) => ({ ...p, [parent]: { ...(p[parent] || {}), [key]: value } }));
    } else {
      setEdit((p) => ({ ...p, [path]: value }));
    }
  };

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const res = await fetch(`${API_BASE}/missions/${mission.id}`, {
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
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-800">
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
          <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
          <select value={edit.type || ''} onChange={(e) => update('type', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200">
            {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
          <select value={edit.status || 'received'} onChange={(e) => update('status', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200">
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Customer phone</label>
          <PhoneInput value={edit.customerPhone} onChange={(v) => update('customerPhone', v)} />
        </div>
      </div>

      {/* Sender details */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
        <h4 className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
          <User className="w-4 h-4" /> Sender details
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <EditableField label="Full name" value={edit.fullName} onChange={(v) => update('fullName', v)} placeholder="Full name" />
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Phone</label>
            <PhoneInput value={edit.customerPhone} onChange={(v) => update('customerPhone', v)} placeholder="501234567" />
          </div>
        </div>
      </div>

      {/* Pickup / sender address */}
      <AddressBlock
        title={isPickup ? 'Pickup Address' : 'Address'}
        addr={edit.address || {}}
        onChange={(a) => update('address', a)}
      />

      {/* Receiver details — pickup only */}
      {isPickup && (
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
          <h4 className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
            <User className="w-4 h-4" /> Receiver Details
            {!edit.receiverName && !edit.receiverPhone && (
              <span className="ml-auto text-xs font-semibold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Missing
              </span>
            )}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <EditableField label="Receiver name" value={edit.receiverName} onChange={(v) => update('receiverName', v)} placeholder="Full name" />
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Receiver phone</label>
              <PhoneInput value={edit.receiverPhone} onChange={(v) => update('receiverPhone', v)} placeholder="501234567" />
            </div>
          </div>
        </div>
      )}

      {/* Delivery address — pickup only */}
      {isPickup && (
        <AddressBlock
          title="Delivery Address"
          addr={edit.receiverAddress || {}}
          onChange={(a) => update('receiverAddress', a)}
          missing={!edit.receiverAddress?.lat}
        />
      )}

      {/* Box selection */}
      <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 space-y-3">
        {isPickup && (
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Boxes to collect from customer</label>
            <input
              type="number" min="0"
              value={edit.pickupBoxCount ?? ''}
              onChange={(e) => setEdit((p) => ({ ...p, pickupBoxCount: parseInt(e.target.value) || 0 }))}
              placeholder="0"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
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
                <label className="block text-xs font-medium text-slate-500 mb-1">ISA-BOX-70 (Large)</label>
                <input
                  type="number" min="0"
                  value={edit.boxSelection?.large ?? ''}
                  onChange={(e) => {
                    const large = parseInt(e.target.value) || 0;
                    const small = edit.boxSelection?.small ?? 0;
                    setEdit((p) => ({ ...p, boxSelection: { large, small } }));
                  }}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">ISA-BOX-35 (Small)</label>
                <input
                  type="number" min="0"
                  value={edit.boxSelection?.small ?? ''}
                  onChange={(e) => {
                    const small = parseInt(e.target.value) || 0;
                    const large = edit.boxSelection?.large ?? 0;
                    setEdit((p) => ({ ...p, boxSelection: { large, small } }));
                  }}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
            </div>
            {((edit.boxSelection?.large || 0) + (edit.boxSelection?.small || 0) > 0) && (
              <p className="text-xs text-blue-600">Total: {(edit.boxSelection?.large || 0) + (edit.boxSelection?.small || 0)} boxes</p>
            )}
          </>
        )}

        {isPickup && edit.bringBoxes === false && (
          <p className="text-xs text-slate-500 italic">No boxes — customer has their own</p>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
        <textarea
          value={edit.notes ?? ''}
          onChange={(e) => update('notes', e.target.value)}
          rows={3}
          placeholder="Notes..."
          className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="flex gap-2 pt-2">
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
            Delete
          </button>
        )}
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <h4 className="font-bold text-slate-800 mb-2">Delete mission?</h4>
            <p className="text-slate-600 text-sm mb-4">
              Delete <strong>{mission.id}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowDeleteConfirm(false)} disabled={deleting} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50">
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
