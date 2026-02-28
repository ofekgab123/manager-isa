import { useState } from 'react';
import { MapPin, User, Save, X } from 'lucide-react';
import AddressSearch from './AddressSearch';
import { API_BASE } from '../config';

const STATUS_OPTIONS = [
  { value: 'received', label: 'התקבל במערכת' },
  { value: 'linewhel_transferred', label: 'הועבר ל-Linewhel' },
  { value: 'linewhel_scheduled', label: 'Linewhel נקבע' },
  { value: 'collected', label: 'נאסף' },
  { value: 'shipped', label: 'נשלח' },
  { value: 'completed', label: 'בוצע' },
];

const TYPE_OPTIONS = [
  { value: 'send', label: 'שליחה' },
  { value: 'pickup', label: 'איסוף' },
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
          {data.displayAddress ? 'שנה כתובת' : 'בחר כתובת'}
        </button>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <EditableField label="עיר" value={data.city} onChange={(v) => onChange({ ...data, city: v })} />
        <EditableField label="רחוב" value={data.street} onChange={(v) => onChange({ ...data, street: v })} />
        <EditableField label="מס' בית" value={data.houseNumber} onChange={(v) => onChange({ ...data, houseNumber: v })} />
        <EditableField label="דירה" value={data.apartment} onChange={(v) => onChange({ ...data, apartment: v })} />
        <EditableField label="קומה" value={data.floor} onChange={(v) => onChange({ ...data, floor: v })} />
      </div>
      {data.displayAddress && (
        <p className="text-sm text-slate-600">כתובת מלאה: {data.displayAddress}</p>
      )}
    </div>
  );
}

export default function OrderDetails({ order, onSave, onClose }) {
  const [edit, setEdit] = useState({ ...order });
  const [saving, setSaving] = useState(false);
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
      if (!res.ok) throw new Error('שגיאה בשמירה');
      onSave?.(await res.json());
    } catch (e) {
      setError(e.message || 'שגיאה');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-800">פרטי ההזמנה – עריכה</h3>
        {onClose && (
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <EditableField label="מזהה" value={edit.id} onChange={() => {}} readOnly />
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">סוג</label>
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
          <label className="block text-xs font-medium text-slate-500 mb-1">סטטוס</label>
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
        <EditableField label="ארגזים" value={edit.boxes} onChange={(v) => update('boxes', parseInt(v) || 0)} type="number" />
        <EditableField label="טלפון לקוח" value={edit.customerPhone} onChange={(v) => update('customerPhone', v)} type="tel" />
        <EditableField label="תאריך נקבע" value={edit.scheduledFor} onChange={(v) => update('scheduledFor', v)} />
        <EditableField label="הוקצה ל" value={edit.assignedTo} onChange={(v) => update('assignedTo', v)} />
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">התקשרו</label>
          <select
            value={edit.contacted ? 'yes' : 'no'}
            onChange={(e) => update('contacted', e.target.value === 'yes')}
            className="w-full px-3 py-2 border rounded-lg text-sm"
          >
            <option value="yes">כן</option>
            <option value="no">לא</option>
          </select>
        </div>
        {(edit.type === 'pickup' || edit.readyAction) && (
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">פעולה</label>
            <select
              value={edit.readyAction || ''}
              onChange={(e) => update('readyAction', e.target.value || null)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">—</option>
              <option value="ready_for_box">Ready for Box</option>
              <option value="pickup">Pickup</option>
            </select>
          </div>
        )}
      </div>

      {/* פרטים אישיים */}
      {(edit.firstName || edit.lastName) && (
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
          <h4 className="font-semibold text-slate-800 flex items-center gap-2">
            <User className="w-4 h-4" />
            פרטים אישיים
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <EditableField label="שם פרטי" value={edit.firstName} onChange={(v) => update('firstName', v)} />
            <EditableField label="שם משפחה" value={edit.lastName} onChange={(v) => update('lastName', v)} />
          </div>
        </div>
      )}

      {/* כתובת ראשית */}
      {edit.address && (
        <AddressBlock
          title="כתובת"
          addr={edit.address || {}}
          onChange={(a) => update('address', a)}
        />
      )}

      {/* פרטי שולח - Pickup Parcel */}
      {(edit.type === 'send' || edit.senderAddress || edit.fullName) && (
        <>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <h4 className="font-semibold text-slate-800 flex items-center gap-2">
              <User className="w-4 h-4" />
              פרטי השולח
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <EditableField label="שם מלא" value={edit.fullName} onChange={(v) => update('fullName', v)} />
              <EditableField label="טלפון ישראלי" value={edit.customerPhone} onChange={(v) => update('customerPhone', v)} type="tel" />
            </div>
          </div>
          <AddressBlock
            title="כתובת איסוף"
            addr={edit.senderAddress || {}}
            onChange={(a) => update('senderAddress', a)}
          />
        </>
      )}

      {/* פרטי נמען */}
      {(edit.type === 'send' || edit.receiverName || edit.receiverAddress) && (
        <>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <h4 className="font-semibold text-slate-800 flex items-center gap-2">
              <User className="w-4 h-4" />
              פרטי הנמען
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <EditableField label="שם" value={edit.receiverName} onChange={(v) => update('receiverName', v)} />
              <EditableField label="טלפון" value={edit.receiverPhone} onChange={(v) => update('receiverPhone', v)} type="tel" />
            </div>
          </div>
          <AddressBlock
            title="כתובת משלוח"
            addr={edit.receiverAddress || {}}
            onChange={(a) => update('receiverAddress', a)}
          />
        </>
      )}

      {/* הערות */}
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">הערות</label>
        <textarea
          value={edit.orderNotes ?? ''}
          onChange={(e) => update('orderNotes', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border rounded-lg text-sm"
        />
      </div>

      {/* פריטים - תצוגה בלבד */}
      {edit.items?.length > 0 && (
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <h4 className="font-semibold text-slate-800 mb-2">פריטים</h4>
          <ul className="text-sm space-y-1">
            {edit.items.map((item) => (
              <li key={item.id}>
                {item.name} × {item.quantity} — ₪{item.price * item.quantity}
              </li>
            ))}
          </ul>
          {edit.totalPrice != null && (
            <p className="font-bold mt-2">סה״כ: ₪{edit.totalPrice}</p>
          )}
        </div>
      )}

      {error && <p className="text-red-500 text-sm">{error}</p>}
      <div className="flex gap-2 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'שומר...' : 'שמור שינויים'}
        </button>
      </div>
    </div>
  );
}
