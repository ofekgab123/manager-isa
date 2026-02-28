import { useState } from 'react';
import { X, Package, Truck, Plus, Minus } from 'lucide-react';
import AddressSearch from './AddressSearch';

const API_BASE = '/api';

export default function CreateOrderModal({ isOpen, onClose, onCreated }) {
  const [orderType, setOrderType] = useState(null); // 'pickup' | 'empty_box'
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Pickup (איסוף ממני) - כמו NewOrderPage
  const [pickupBoxes, setPickupBoxes] = useState(1);
  const [pickupAddress, setPickupAddress] = useState(null);
  const [pickupPhone, setPickupPhone] = useState('');

  // Empty box - כמו BillingDetailsPage
  const [emptyBoxForm, setEmptyBoxForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    city: '',
    streetName: '',
    houseNumber: '',
    apartment: '',
    floor: '',
    orderNotes: '',
  });
  const [emptyBoxAddress, setEmptyBoxAddress] = useState(null);

  const handleChangeEmptyBox = (e) => {
    setEmptyBoxForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  };

  const handleEmptyBoxAddressSelect = (addr) => {
    setEmptyBoxAddress(addr);
    setEmptyBoxForm((p) => ({
      ...p,
      city: addr?.city || p.city,
      streetName: addr?.street || p.streetName,
      houseNumber: addr?.houseNumber || p.houseNumber,
    }));
  };

  const resetForm = () => {
    setOrderType(null);
    setPickupBoxes(1);
    setPickupAddress(null);
    setPickupPhone('');
    setEmptyBoxForm({
      firstName: '',
      lastName: '',
      phone: '',
      city: '',
      streetName: '',
      houseNumber: '',
      apartment: '',
      floor: '',
      orderNotes: '',
    });
    setEmptyBoxAddress(null);
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const submitPickup = async () => {
    if (!pickupAddress || !pickupPhone.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'pickup',
          boxes: pickupBoxes,
          address: {
            displayAddress: pickupAddress.displayAddress,
            lat: pickupAddress.lat,
            lng: pickupAddress.lng,
            city: pickupAddress.city,
            street: pickupAddress.street,
            houseNumber: pickupAddress.houseNumber,
          },
          customerPhone: pickupPhone.trim(),
          createdBy: 'customer_service',
          contacted: true,
        }),
      });
      if (!res.ok) throw new Error('שגיאה בשמירה');
      const order = await res.json();
      onCreated?.(order);
      handleClose();
    } catch (e) {
      setError(e.message || 'שגיאה');
    } finally {
      setSubmitting(false);
    }
  };

  const submitEmptyBox = async () => {
    const { firstName, lastName, phone, city, streetName, houseNumber, apartment, floor, orderNotes } = emptyBoxForm;
    const hasAddress = emptyBoxAddress || (city && streetName && houseNumber);
    if (!firstName.trim() || !lastName.trim() || !phone.trim() || !hasAddress) return;
    setSubmitting(true);
    setError('');
    try {
      const address = emptyBoxAddress || {
        displayAddress: [streetName, houseNumber, city].filter(Boolean).join(', '),
        lat: null,
        lng: null,
        city,
        street: streetName,
        houseNumber,
      };
      const res = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'empty_box',
          boxes: 0,
          address: {
            ...address,
            apartment,
            floor,
          },
          customerPhone: phone.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          orderNotes: orderNotes.trim() || undefined,
          createdBy: 'customer_service',
          contacted: true,
        }),
      });
      if (!res.ok) throw new Error('שגיאה בשמירה');
      const order = await res.json();
      onCreated?.(order);
      handleClose();
    } catch (e) {
      setError(e.message || 'שגיאה');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-t-xl sm:rounded-xl w-full max-w-lg max-h-[95vh] overflow-y-auto shadow-xl">
        <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">צור הזמנה חדשה</h2>
          <button onClick={handleClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6">
          {!orderType ? (
            <>
              <p className="text-slate-600 mb-4">בחר סוג הזמנה:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setOrderType('pickup')}
                  className="p-6 rounded-xl border-2 border-slate-200 hover:border-slate-600 hover:bg-slate-50 flex flex-col items-center gap-3 transition"
                >
                  <Truck className="w-12 h-12 text-slate-600" />
                  <span className="font-semibold text-slate-800">איסוף ממני</span>
                  <span className="text-sm text-slate-500 text-center">לקוח רוצה שנאסוף ממנו אחרי האריזה</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOrderType('empty_box')}
                  className="p-6 rounded-xl border-2 border-slate-200 hover:border-slate-600 hover:bg-slate-50 flex flex-col items-center gap-3 transition"
                >
                  <Package className="w-12 h-12 text-slate-600" />
                  <span className="font-semibold text-slate-800">הזמנת ארגז ריק</span>
                  <span className="text-sm text-slate-500 text-center">שליחת ארגזים ריקים לכתובת הלקוח</span>
                </button>
              </div>
            </>
          ) : orderType === 'pickup' ? (
            <form
              onSubmit={(e) => { e.preventDefault(); submitPickup(); }}
              className="space-y-4"
            >
              <button type="button" onClick={() => setOrderType(null)} className="text-sm text-slate-500 hover:text-slate-700">
                ← חזור
              </button>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">טלפון לקוח *</label>
                <input
                  type="tel"
                  value={pickupPhone}
                  onChange={(e) => setPickupPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="0501234567"
                  required
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">כתובת לאיסוף *</label>
                <AddressSearch
                  value={pickupAddress}
                  onChange={setPickupAddress}
                  onClear={() => setPickupAddress(null)}
                  placeholder="חפש כתובת"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">כמות ארגזים</label>
                <div className="flex items-center gap-4">
                  <button type="button" onClick={() => setPickupBoxes((b) => Math.max(1, b - 1))} className="p-2 border rounded-lg hover:bg-slate-50">
                    <Minus className="w-5 h-5" />
                  </button>
                  <span className="text-xl font-bold w-12 text-center">{pickupBoxes}</span>
                  <button type="button" onClick={() => setPickupBoxes((b) => b + 1)} className="p-2 border rounded-lg hover:bg-slate-50">
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={handleClose} className="flex-1 py-2.5 border rounded-lg">
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={!pickupAddress || !pickupPhone.trim() || submitting}
                  className="flex-1 py-2.5 bg-slate-700 text-white rounded-lg font-medium disabled:opacity-50"
                >
                  {submitting ? 'שומר...' : 'צור הזמנה'}
                </button>
              </div>
            </form>
          ) : (
            <form
              onSubmit={(e) => { e.preventDefault(); submitEmptyBox(); }}
              className="space-y-4"
            >
              <button type="button" onClick={() => setOrderType(null)} className="text-sm text-slate-500 hover:text-slate-700">
                ← חזור
              </button>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">שם פרטי *</label>
                  <input
                    type="text"
                    name="firstName"
                    value={emptyBoxForm.firstName}
                    onChange={handleChangeEmptyBox}
                    placeholder="ישראל"
                    required
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">שם משפחה *</label>
                  <input
                    type="text"
                    name="lastName"
                    value={emptyBoxForm.lastName}
                    onChange={handleChangeEmptyBox}
                    placeholder="ישראלי"
                    required
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">טלפון *</label>
                <input
                  type="tel"
                  name="phone"
                  value={emptyBoxForm.phone}
                  onChange={handleChangeEmptyBox}
                  placeholder="0501234567"
                  required
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">כתובת למשלוח *</label>
                <AddressSearch
                  value={emptyBoxAddress}
                  onChange={handleEmptyBoxAddressSelect}
                  onClear={() => { setEmptyBoxAddress(null); setEmptyBoxForm((p) => ({ ...p, city: '', streetName: '', houseNumber: '' })); }}
                  placeholder="חפש כתובת"
                />
                {(emptyBoxAddress || emptyBoxForm.city) && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                    <input
                      type="text"
                      name="city"
                      value={emptyBoxForm.city}
                      onChange={handleChangeEmptyBox}
                      placeholder="עיר"
                      className="px-3 py-2 border rounded-lg text-sm"
                    />
                    <input
                      type="text"
                      name="streetName"
                      value={emptyBoxForm.streetName}
                      onChange={handleChangeEmptyBox}
                      placeholder="רחוב"
                      className="px-3 py-2 border rounded-lg text-sm"
                    />
                    <input
                      type="text"
                      name="houseNumber"
                      value={emptyBoxForm.houseNumber}
                      onChange={handleChangeEmptyBox}
                      placeholder="מס' בית"
                      className="px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <input
                    type="text"
                    name="apartment"
                    value={emptyBoxForm.apartment}
                    onChange={handleChangeEmptyBox}
                    placeholder="דירה (אופציונלי)"
                    className="px-3 py-2 border rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    name="floor"
                    value={emptyBoxForm.floor}
                    onChange={handleChangeEmptyBox}
                    placeholder="קומה (אופציונלי)"
                    className="px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">הערות (אופציונלי)</label>
                <textarea
                  name="orderNotes"
                  value={emptyBoxForm.orderNotes}
                  onChange={handleChangeEmptyBox}
                  placeholder="הערות להזמנה"
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={handleClose} className="flex-1 py-2.5 border rounded-lg">
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={!emptyBoxForm.firstName.trim() || !emptyBoxForm.lastName.trim() || !emptyBoxForm.phone.trim() || (!emptyBoxAddress && !(emptyBoxForm.city && emptyBoxForm.streetName && emptyBoxForm.houseNumber)) || submitting}
                  className="flex-1 py-2.5 bg-slate-700 text-white rounded-lg font-medium disabled:opacity-50"
                >
                  {submitting ? 'שומר...' : 'צור הזמנה'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
