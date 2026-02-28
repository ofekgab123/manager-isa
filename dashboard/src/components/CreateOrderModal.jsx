import { useState } from 'react';
import { X, Package, Truck, MapPin } from 'lucide-react';
import AddressSearch from './AddressSearch';
import { geocodeAddress } from '../utils/geocode';

const API_BASE = '/api';

const PICKUP_STEPS = [
  { id: 1, label: 'פרטי השולח' },
  { id: 2, label: 'כתובת איסוף' },
  { id: 3, label: 'פרטי הנמען' },
  { id: 4, label: 'כתובת משלוח' },
  { id: 5, label: 'סיכום' },
];

export default function CreateOrderModal({ isOpen, onClose, onCreated }) {
  const [orderType, setOrderType] = useState(null); // 'pickup' | 'empty_box'
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Pickup Parcel - 5 steps כמו PickupParcelPage
  const [pickupStep, setPickupStep] = useState(1);
  const [addressPickerFor, setAddressPickerFor] = useState(null);
  const [pickupForm, setPickupForm] = useState({
    israeliPhone: '',
    fullName: '',
    senderCity: '',
    senderHouseNumber: '',
    senderStreet: '',
    senderApartment: '',
    senderFloor: '',
    receiverName: '',
    receiverPhone: '',
    receiverCity: '',
    receiverHouseNumber: '',
    receiverStreet: '',
    receiverApartment: '',
    receiverFloor: '',
  });
  const [senderMapAddress, setSenderMapAddress] = useState(null);
  const [receiverMapAddress, setReceiverMapAddress] = useState(null);

  // Empty box - כמו BillingDetailsPage
  const [emptyBoxForm, setEmptyBoxForm] = useState({
    firstName: '',
    lastName: '',
    country: 'Israel',
    city: '',
    streetName: '',
    houseNumber: '',
    apartment: '',
    floor: '',
    phone: '',
    orderNotes: '',
  });
  const [emptyBoxAddress, setEmptyBoxAddress] = useState(null);

  const handleChange = (e, form) => {
    const setter = form === 'pickup' ? setPickupForm : setEmptyBoxForm;
    setter((p) => ({ ...p, [e.target.name]: e.target.value }));
  };

  const handlePickupAddressSelect = (addr, forWho) => {
    const update = {
      displayAddress: addr.displayAddress,
      lat: addr.lat,
      lng: addr.lng,
      city: addr.city || '',
      street: addr.street || '',
      houseNumber: addr.houseNumber || '',
    };
    if (forWho === 'sender') {
      setSenderMapAddress(addr);
      setPickupForm((p) => ({
        ...p,
        senderCity: update.city || p.senderCity,
        senderStreet: update.street || p.senderStreet,
        senderHouseNumber: update.houseNumber || p.senderHouseNumber,
      }));
    } else {
      setReceiverMapAddress(addr);
      setPickupForm((p) => ({
        ...p,
        receiverCity: update.city || p.receiverCity,
        receiverStreet: update.street || p.receiverStreet,
        receiverHouseNumber: update.houseNumber || p.receiverHouseNumber,
      }));
    }
    setAddressPickerFor(null);
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
    setPickupStep(1);
    setPickupForm({
      israeliPhone: '',
      fullName: '',
      senderCity: '',
      senderHouseNumber: '',
      senderStreet: '',
      senderApartment: '',
      senderFloor: '',
      receiverName: '',
      receiverPhone: '',
      receiverCity: '',
      receiverHouseNumber: '',
      receiverStreet: '',
      receiverApartment: '',
      receiverFloor: '',
    });
    setSenderMapAddress(null);
    setReceiverMapAddress(null);
    setEmptyBoxForm({
      firstName: '',
      lastName: '',
      country: 'Israel',
      city: '',
      streetName: '',
      houseNumber: '',
      apartment: '',
      floor: '',
      phone: '',
      orderNotes: '',
    });
    setEmptyBoxAddress(null);
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const resolveAddressCoords = async (mapAddr, city, street, houseNumber) => {
    const unchanged =
      mapAddr &&
      String(city || '').trim() === String(mapAddr.city || '').trim() &&
      String(street || '').trim() === String(mapAddr.street || '').trim() &&
      String(houseNumber || '').trim() === String(mapAddr.houseNumber || '').trim();
    if (unchanged && mapAddr) return { lat: mapAddr.lat, lng: mapAddr.lng };
    const coords = await geocodeAddress({ city, street, houseNumber });
    return coords || (mapAddr ? { lat: mapAddr.lat, lng: mapAddr.lng } : null);
  };

  const submitPickup = async () => {
    const [senderCoords, receiverCoords] = await Promise.all([
      resolveAddressCoords(
        senderMapAddress,
        pickupForm.senderCity,
        pickupForm.senderStreet,
        pickupForm.senderHouseNumber
      ),
      resolveAddressCoords(
        receiverMapAddress,
        pickupForm.receiverCity,
        pickupForm.receiverStreet,
        pickupForm.receiverHouseNumber
      ),
    ]);
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'send',
          boxes: 0,
          createdBy: 'customer_service',
          contacted: true,
          status: 'linewhel_transferred',
          customerPhone: pickupForm.israeliPhone,
          fullName: pickupForm.fullName,
          senderAddress: {
            displayAddress: senderMapAddress?.displayAddress || [pickupForm.senderStreet, pickupForm.senderHouseNumber, pickupForm.senderCity].filter(Boolean).join(', '),
            lat: senderCoords?.lat,
            lng: senderCoords?.lng,
            city: pickupForm.senderCity,
            street: pickupForm.senderStreet,
            houseNumber: pickupForm.senderHouseNumber,
            apartment: pickupForm.senderApartment,
            floor: pickupForm.senderFloor,
          },
          receiverName: pickupForm.receiverName,
          receiverPhone: pickupForm.receiverPhone,
          receiverAddress: {
            displayAddress: receiverMapAddress?.displayAddress || [pickupForm.receiverStreet, pickupForm.receiverHouseNumber, pickupForm.receiverCity].filter(Boolean).join(', '),
            lat: receiverCoords?.lat,
            lng: receiverCoords?.lng,
            city: pickupForm.receiverCity,
            street: pickupForm.receiverStreet,
            houseNumber: pickupForm.receiverHouseNumber,
            apartment: pickupForm.receiverApartment,
            floor: pickupForm.receiverFloor,
          },
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
    const hasAddress = emptyBoxAddress || (streetName && city && houseNumber);
    if (!firstName.trim() || !lastName.trim() || !phone.trim() || !hasAddress) return;
    setSubmitting(true);
    setError('');
    try {
      const coords = await resolveAddressCoords(emptyBoxAddress, city, streetName, houseNumber);
      const address = emptyBoxAddress || {
        displayAddress: [streetName, houseNumber, city].filter(Boolean).join(', '),
        lat: coords?.lat,
        lng: coords?.lng,
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
          address: { ...address, apartment, floor },
          customerPhone: phone.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          orderNotes: orderNotes.trim() || undefined,
          createdBy: 'customer_service',
          contacted: true,
          status: 'linewhel_transferred',
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
      <div className="bg-white rounded-t-xl sm:rounded-xl w-full max-w-2xl max-h-[95vh] overflow-y-auto shadow-xl">
        <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between z-10">
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
                  <span className="font-semibold text-slate-800">איסוף חבילה</span>
                  <span className="text-sm text-slate-500 text-center">Pickup Parcel - איסוף ממני ומשלוח לנמען</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOrderType('empty_box')}
                  className="p-6 rounded-xl border-2 border-slate-200 hover:border-slate-600 hover:bg-slate-50 flex flex-col items-center gap-3 transition"
                >
                  <Package className="w-12 h-12 text-slate-600" />
                  <span className="font-semibold text-slate-800">הזמנת ארגז ריק</span>
                  <span className="text-sm text-slate-500 text-center">Empty Box - שליחת ארגזים ריקים</span>
                </button>
              </div>
            </>
          ) : orderType === 'pickup' ? (
            <div className="space-y-6">
              <button type="button" onClick={() => setOrderType(null)} className="text-sm text-slate-500 hover:text-slate-700">
                ← חזור
              </button>

              {/* Progress - 5 steps */}
              <div className="flex justify-between gap-1">
                {PICKUP_STEPS.map((s, i) => (
                  <div key={s.id} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        pickupStep === s.id ? 'bg-slate-700 text-white' : pickupStep > s.id ? 'bg-slate-400 text-white' : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {s.id}
                    </div>
                    <span className="text-[10px] text-center truncate max-w-[50px] text-slate-600">{s.label}</span>
                  </div>
                ))}
              </div>

              {pickupStep === 1 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">פרטי השולח</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">טלפון ישראלי *</label>
                      <input
                        type="tel"
                        name="israeliPhone"
                        value={pickupForm.israeliPhone}
                        onChange={(e) => handleChange(e, 'pickup')}
                        placeholder="050-1234567"
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">שם מלא *</label>
                      <input
                        type="text"
                        name="fullName"
                        value={pickupForm.fullName}
                        onChange={(e) => handleChange(e, 'pickup')}
                        placeholder="Full Name"
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              )}

              {pickupStep === 2 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">כתובת איסוף בישראל</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">בחר כתובת</label>
                      {addressPickerFor === 'sender' ? (
                        <AddressSearch
                          value={senderMapAddress}
                          onChange={(addr) => handlePickupAddressSelect(addr, 'sender')}
                          onClear={() => { setSenderMapAddress(null); setPickupForm((p) => ({ ...p, senderCity: '', senderStreet: '', senderHouseNumber: '' })); setAddressPickerFor(null); }}
                          placeholder="חפש כתובת"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setAddressPickerFor('sender')}
                          className="w-full p-4 rounded-xl border-2 border-dashed border-slate-300 hover:border-slate-500 flex items-center justify-center gap-2"
                        >
                          <MapPin className="w-5 h-5" />
                          {senderMapAddress ? senderMapAddress.displayAddress : 'חפש כתובת'}
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm mb-1">עיר</label>
                        <input
                          type="text"
                          name="senderCity"
                          value={pickupForm.senderCity}
                          onChange={(e) => handleChange(e, 'pickup')}
                          placeholder="לחץ לבחירת כתובת"
                          readOnly={!senderMapAddress}
                          className={`w-full px-3 py-2 border rounded-lg ${!senderMapAddress ? 'bg-slate-100' : ''}`}
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">רחוב *</label>
                        <input
                          type="text"
                          name="senderStreet"
                          value={pickupForm.senderStreet}
                          onChange={(e) => handleChange(e, 'pickup')}
                          placeholder="לחץ לבחירת כתובת"
                          readOnly={!senderMapAddress}
                          className={`w-full px-3 py-2 border rounded-lg ${!senderMapAddress ? 'bg-slate-100' : ''}`}
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">מס' בית *</label>
                        <input
                          type="text"
                          name="senderHouseNumber"
                          value={pickupForm.senderHouseNumber}
                          onChange={(e) => handleChange(e, 'pickup')}
                          placeholder="לחץ לבחירת כתובת"
                          readOnly={!senderMapAddress}
                          className={`w-full px-3 py-2 border rounded-lg ${!senderMapAddress ? 'bg-slate-100' : ''}`}
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">דירה</label>
                        <input
                          type="text"
                          name="senderApartment"
                          value={pickupForm.senderApartment}
                          onChange={(e) => handleChange(e, 'pickup')}
                          placeholder="3"
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">קומה</label>
                        <input
                          type="text"
                          name="senderFloor"
                          value={pickupForm.senderFloor}
                          onChange={(e) => handleChange(e, 'pickup')}
                          placeholder="2"
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {pickupStep === 3 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">פרטי הנמען</h3>
                  <p className="text-sm text-slate-600 mb-4">מי יקבל את החבילה?</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">שם מלא *</label>
                      <input
                        type="text"
                        name="receiverName"
                        value={pickupForm.receiverName}
                        onChange={(e) => handleChange(e, 'pickup')}
                        placeholder="Receiver name"
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">טלפון *</label>
                      <input
                        type="tel"
                        name="receiverPhone"
                        value={pickupForm.receiverPhone}
                        onChange={(e) => handleChange(e, 'pickup')}
                        placeholder="050-1234567"
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              )}

              {pickupStep === 4 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">כתובת משלוח</h3>
                  <p className="text-sm text-slate-600 mb-4">לאן לשלוח את החבילה?</p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">בחר כתובת</label>
                      {addressPickerFor === 'receiver' ? (
                        <AddressSearch
                          value={receiverMapAddress}
                          onChange={(addr) => handlePickupAddressSelect(addr, 'receiver')}
                          onClear={() => { setReceiverMapAddress(null); setPickupForm((p) => ({ ...p, receiverCity: '', receiverStreet: '', receiverHouseNumber: '' })); setAddressPickerFor(null); }}
                          placeholder="חפש כתובת"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setAddressPickerFor('receiver')}
                          className="w-full p-4 rounded-xl border-2 border-dashed border-slate-300 hover:border-slate-500 flex items-center justify-center gap-2"
                        >
                          <MapPin className="w-5 h-5" />
                          {receiverMapAddress ? receiverMapAddress.displayAddress : 'חפש כתובת'}
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm mb-1">עיר</label>
                        <input
                          type="text"
                          name="receiverCity"
                          value={pickupForm.receiverCity}
                          onChange={(e) => handleChange(e, 'pickup')}
                          placeholder="לחץ לבחירת כתובת"
                          readOnly={!receiverMapAddress}
                          className={`w-full px-3 py-2 border rounded-lg ${!receiverMapAddress ? 'bg-slate-100' : ''}`}
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">רחוב *</label>
                        <input
                          type="text"
                          name="receiverStreet"
                          value={pickupForm.receiverStreet}
                          onChange={(e) => handleChange(e, 'pickup')}
                          placeholder="לחץ לבחירת כתובת"
                          readOnly={!receiverMapAddress}
                          className={`w-full px-3 py-2 border rounded-lg ${!receiverMapAddress ? 'bg-slate-100' : ''}`}
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">מס' בית *</label>
                        <input
                          type="text"
                          name="receiverHouseNumber"
                          value={pickupForm.receiverHouseNumber}
                          onChange={(e) => handleChange(e, 'pickup')}
                          placeholder="לחץ לבחירת כתובת"
                          readOnly={!receiverMapAddress}
                          className={`w-full px-3 py-2 border rounded-lg ${!receiverMapAddress ? 'bg-slate-100' : ''}`}
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">דירה</label>
                        <input
                          type="text"
                          name="receiverApartment"
                          value={pickupForm.receiverApartment}
                          onChange={(e) => handleChange(e, 'pickup')}
                          placeholder="3"
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">קומה</label>
                        <input
                          type="text"
                          name="receiverFloor"
                          value={pickupForm.receiverFloor}
                          onChange={(e) => handleChange(e, 'pickup')}
                          placeholder="2"
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {pickupStep === 5 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">סיכום</h3>
                  <div className="space-y-4 text-slate-700">
                    <div className="p-4 rounded-xl bg-slate-50">
                      <h4 className="font-semibold text-slate-800 mb-2">פרטי השולח</h4>
                      <p>{pickupForm.fullName}</p>
                      <p>{pickupForm.israeliPhone}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50">
                      <h4 className="font-semibold text-slate-800 mb-2">כתובת איסוף</h4>
                      <p>{senderMapAddress?.displayAddress || [pickupForm.senderStreet, pickupForm.senderHouseNumber, pickupForm.senderCity].filter(Boolean).join(', ')}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50">
                      <h4 className="font-semibold text-slate-800 mb-2">נמען</h4>
                      <p>{pickupForm.receiverName}</p>
                      <p>{pickupForm.receiverPhone}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50">
                      <h4 className="font-semibold text-slate-800 mb-2">כתובת משלוח</h4>
                      <p>{receiverMapAddress?.displayAddress || [pickupForm.receiverStreet, pickupForm.receiverHouseNumber, pickupForm.receiverCity].filter(Boolean).join(', ')}</p>
                    </div>
                  </div>
                </div>
              )}

              {error && <p className="text-red-500 text-sm">{error}</p>}
              <div className="flex gap-4 pt-4">
                {pickupStep > 1 ? (
                  <button type="button" onClick={() => setPickupStep((s) => s - 1)} className="flex-1 py-2.5 border rounded-lg">
                    הקודם
                  </button>
                ) : (
                  <div className="flex-1" />
                )}
                {pickupStep < 5 ? (
                  <button
                    type="button"
                    onClick={() => setPickupStep((s) => s + 1)}
                    className="flex-1 py-2.5 bg-slate-700 text-white rounded-lg font-medium"
                  >
                    הבא
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={submitPickup}
                    disabled={
                      !pickupForm.israeliPhone.trim() ||
                      !pickupForm.fullName.trim() ||
                      !senderMapAddress ||
                      !pickupForm.receiverName.trim() ||
                      !pickupForm.receiverPhone.trim() ||
                      !receiverMapAddress ||
                      submitting
                    }
                    className="flex-1 py-2.5 bg-slate-700 text-white rounded-lg font-medium disabled:opacity-50"
                  >
                    {submitting ? 'שומר...' : 'צור הזמנה (הועבר ל-Linewhel)'}
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Empty Box - כמו BillingDetailsPage */
            <form onSubmit={(e) => { e.preventDefault(); submitEmptyBox(); }} className="space-y-6">
              <button type="button" onClick={() => setOrderType(null)} className="text-sm text-slate-500 hover:text-slate-700">
                ← חזור
              </button>

              <div>
                <h3 className="text-lg font-semibold mb-4">פרטים אישיים</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">שם פרטי *</label>
                    <input
                      type="text"
                      name="firstName"
                      value={emptyBoxForm.firstName}
                      onChange={(e) => handleChange(e, 'empty_box')}
                      placeholder="First Name"
                      required
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">שם משפחה *</label>
                    <input
                      type="text"
                      name="lastName"
                      value={emptyBoxForm.lastName}
                      onChange={(e) => handleChange(e, 'empty_box')}
                      placeholder="Last Name"
                      required
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium mb-1">טלפון *</label>
                  <input
                    type="tel"
                    name="phone"
                    value={emptyBoxForm.phone}
                    onChange={(e) => handleChange(e, 'empty_box')}
                    placeholder="050-1234567"
                    required
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">כתובת למשלוח *</h3>
                <p className="text-sm text-slate-600 mb-2">חפש כתובת או מלא ידנית</p>
                <AddressSearch
                  value={emptyBoxAddress}
                  onChange={handleEmptyBoxAddressSelect}
                  onClear={() => { setEmptyBoxAddress(null); setEmptyBoxForm((p) => ({ ...p, city: '', streetName: '', houseNumber: '' })); }}
                  placeholder="חפש כתובת"
                />
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm mb-1">עיר</label>
                    <input
                      type="text"
                      name="city"
                      value={emptyBoxForm.city}
                      onChange={(e) => handleChange(e, 'empty_box')}
                      placeholder="לחץ לבחירת כתובת"
                      readOnly={!emptyBoxAddress}
                      className={`w-full px-3 py-2 border rounded-lg ${!emptyBoxAddress ? 'bg-slate-100' : ''}`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">רחוב</label>
                    <input
                      type="text"
                      name="streetName"
                      value={emptyBoxForm.streetName}
                      onChange={(e) => handleChange(e, 'empty_box')}
                      placeholder="לחץ לבחירת כתובת"
                      readOnly={!emptyBoxAddress}
                      className={`w-full px-3 py-2 border rounded-lg ${!emptyBoxAddress ? 'bg-slate-100' : ''}`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">מס' בית</label>
                    <input
                      type="text"
                      name="houseNumber"
                      value={emptyBoxForm.houseNumber}
                      onChange={(e) => handleChange(e, 'empty_box')}
                      placeholder="לחץ לבחירת כתובת"
                      readOnly={!emptyBoxAddress}
                      className={`w-full px-3 py-2 border rounded-lg ${!emptyBoxAddress ? 'bg-slate-100' : ''}`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">דירה (אופציונלי)</label>
                    <input
                      type="text"
                      name="apartment"
                      value={emptyBoxForm.apartment}
                      onChange={(e) => handleChange(e, 'empty_box')}
                      placeholder="3"
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">קומה (אופציונלי)</label>
                    <input
                      type="text"
                      name="floor"
                      value={emptyBoxForm.floor}
                      onChange={(e) => handleChange(e, 'empty_box')}
                      placeholder="2"
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">הערות (אופציונלי)</h3>
                <textarea
                  name="orderNotes"
                  value={emptyBoxForm.orderNotes}
                  onChange={(e) => handleChange(e, 'empty_box')}
                  placeholder="Notes about your order"
                  rows={3}
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
                  disabled={
                    !emptyBoxForm.firstName.trim() ||
                    !emptyBoxForm.lastName.trim() ||
                    !emptyBoxForm.phone.trim() ||
                    (!emptyBoxAddress && !(emptyBoxForm.streetName && emptyBoxForm.city && emptyBoxForm.houseNumber)) ||
                    submitting
                  }
                  className="flex-1 py-2.5 bg-slate-700 text-white rounded-lg font-medium disabled:opacity-50"
                >
                  {submitting ? 'שומר...' : 'צור הזמנה (הועבר ל-Linewhel)'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
