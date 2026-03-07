import { useState, useEffect, useRef } from 'react';
import { X, Package, Truck, MapPin, User, Home, CheckCircle, ChevronRight, ChevronLeft, ClipboardList, Box, Plus, Minus } from 'lucide-react';
import AddressPicker from './AddressPicker';
import PhoneInput from './PhoneInput';
import { geocodeAddress } from '../utils/geocode';
import { API_BASE } from '../config';

/* ─── Step definitions ───────────────────────────────────────── */

const BOX_TYPES = [
  { id: 'large', label: 'ISA-BOX-70',  sub: 'Large – 45×45×70 cm · up to 50 kg', icon: Box,     color: 'indigo' },
  { id: 'small', label: 'ISA-BOX-35',  sub: 'Small – 45×45×35 cm · up to 30 kg', icon: Package, color: 'blue'   },
];

const PICKUP_STEPS = [
  { id: 1, label: 'Sender Details',   icon: User },
  { id: 2, label: 'Pickup Address',   icon: Home },
  { id: 3, label: 'Boxes',            icon: Package },
  { id: 4, label: 'Receiver',         icon: User,        optional: true },
  { id: 5, label: 'Delivery Address', icon: Home,        optional: true },
  { id: 6, label: 'Summary',          icon: CheckCircle },
];

/* ─── Sub-components ─────────────────────────────────────────── */
function StepBar({ steps, current }) {
  return (
    <div className="flex items-center gap-0 mb-6">
      {steps.map((s, i) => {
        const done = current > s.id;
        const active = current === s.id;
        const Icon = s.icon;
        return (
          <div key={s.id} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                done   ? 'bg-indigo-600 border-indigo-600 text-white' :
                active ? 'bg-white border-indigo-600 text-indigo-600' :
                         'bg-white border-slate-200 text-slate-400'
              }`}>
                {done ? <CheckCircle className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>
              <span className={`text-[10px] font-medium whitespace-nowrap ${
                active ? 'text-indigo-700' : done ? 'text-indigo-400' : 'text-slate-400'
              }`}>{s.label}</span>
              {s.optional && (
                <span className="text-[9px] text-slate-400 whitespace-nowrap">optional</span>
              )}
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 flex-1 mx-1 mb-4 transition-colors ${done ? 'bg-indigo-400' : 'bg-slate-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = 'w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 transition';
const readonlyCls = 'w-full px-3 py-2.5 border border-slate-100 rounded-xl text-sm bg-slate-50 text-slate-500 cursor-default';

function SuggestionDropdown({ suggestions, onSelect }) {
  return (
    <ul className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
      {suggestions.map((u) => (
        <li key={u.id}>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); onSelect(u); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-indigo-50 transition-colors text-left"
          >
            <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
              <User className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{u.fullName}</p>
              <p className="text-xs text-slate-400 truncate">
                {u.phone}{u.address?.displayAddress ? ` · ${u.address.displayAddress}` : ''}
              </p>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function MissionCheckbox({ checked, onChange, missionType }) {
  const isBox = missionType === 'ready_for_box';
  return (
    <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
      checked ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50'
    }`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 accent-indigo-600 cursor-pointer flex-shrink-0"
      />
      <div>
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-semibold text-slate-800">Create mission with this order</span>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          A <span className="font-medium text-indigo-600">{isBox ? 'Ready for Box' : 'Ready for Pickup'}</span> mission will be created with the order details
        </p>
      </div>
    </label>
  );
}

function SummaryRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-slate-500 w-32 flex-shrink-0">{label}</span>
      <span className="text-slate-800 font-medium">{value}</span>
    </div>
  );
}

function AddressBlock({ mapAddr, form, prefix, onMap, onClear }) {
  const city   = form[`${prefix}City`]   || form.city        || '';
  const street = form[`${prefix}Street`] || form.streetName  || '';
  const house  = form[`${prefix}HouseNumber`] || form.houseNumber || '';
  const apt    = form[`${prefix}Apartment`]   || form.apartment  || '';
  const floor  = form[`${prefix}Floor`]        || form.floor      || '';
  return (
    <div className="space-y-3">
      {mapAddr ? (
        <div className="flex items-start gap-3 p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
          <MapPin className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">{mapAddr.displayAddress}</p>
            {mapAddr.lat != null && (
              <p className="text-xs font-mono text-slate-400">{Number(mapAddr.lat).toFixed(5)}, {Number(mapAddr.lng).toFixed(5)}</p>
            )}
          </div>
          <button type="button" onClick={onClear} className="text-slate-300 hover:text-red-500 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={onMap}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed border-slate-300 rounded-xl text-sm text-slate-600 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all">
          <MapPin className="w-4 h-4" />
          Pick on map
        </button>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Field label="City"><input className={mapAddr ? inputCls : readonlyCls} readOnly={!mapAddr} value={city} onChange={() => {}} placeholder="From address" /></Field>
        <Field label="Street"><input className={mapAddr ? inputCls : readonlyCls} readOnly={!mapAddr} value={street} onChange={() => {}} placeholder="From address" /></Field>
        <Field label="House no."><input className={mapAddr ? inputCls : readonlyCls} readOnly={!mapAddr} value={house} onChange={() => {}} placeholder="From address" /></Field>
        <Field label="Apartment"><input className={inputCls} value={apt} onChange={() => {}} placeholder="3" /></Field>
        <Field label="Floor"><input className={inputCls} value={floor} onChange={() => {}} placeholder="2" /></Field>
      </div>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────── */
export default function CreateOrderModal({ isOpen, onClose, onCreated }) {
  const [orderType, setOrderType] = useState(null); // null | 'pickup' | 'empty_box'
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [addressMapOpenFor, setAddressMapOpenFor] = useState(null);

  // Pickup form
  const [pickupForm, setPickupForm] = useState({
    israeliPhone: '', fullName: '',
    senderCity: '', senderStreet: '', senderHouseNumber: '', senderApartment: '', senderFloor: '',
    receiverName: '', receiverPhone: '',
    receiverCity: '', receiverStreet: '', receiverHouseNumber: '', receiverApartment: '', receiverFloor: '',
  });
  const [senderMapAddress, setSenderMapAddress] = useState(null);
  const [receiverMapAddress, setReceiverMapAddress] = useState(null);

  const [boxCounts, setBoxCounts] = useState({ large: 0, small: 0 });
  const changeBoxCount = (type, delta) =>
    setBoxCounts((p) => ({ ...p, [type]: Math.max(0, p[type] + delta) }));

  // Mission creation alongside order
  const [createMission, setCreateMission] = useState(false);
  const [missionLargeBoxes, setMissionLargeBoxes] = useState('');
  const [missionSmallBoxes, setMissionSmallBoxes] = useState('');

  /* ─── User autocomplete ──────────────────────────────── */
  const [allUsers, setAllUsers] = useState([]);
  const [userSuggestions, setUserSuggestions] = useState([]);
  const [activeField, setActiveField] = useState(null);
  const suggestRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    fetch(`${API_BASE}/users`).then((r) => r.json()).then(setAllUsers).catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    const handler = (e) => {
      if (suggestRef.current && !suggestRef.current.contains(e.target)) {
        setUserSuggestions([]);
        setActiveField(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filterSuggestions = (fieldName, value) => {
    if (!value.trim()) { setUserSuggestions([]); return; }
    const q = value.toLowerCase();
    const matches = allUsers.filter((u) => {
      if (fieldName === 'fullName')     return (u.fullName || '').toLowerCase().includes(q);
      if (fieldName === 'israeliPhone') return (u.phone || '').replace(/\D/g, '').includes(q.replace(/\D/g, ''));
      return false;
    });
    setUserSuggestions(matches.slice(0, 6));
  };

  const applySuggestion = (u) => {
    setPickupForm((p) => ({
      ...p,
      fullName: u.fullName || p.fullName,
      israeliPhone: u.phone || p.israeliPhone,
      ...(u.address?.lat ? {
        senderCity:        u.address.city        || p.senderCity,
        senderStreet:      u.address.street      || p.senderStreet,
        senderHouseNumber: u.address.houseNumber || p.senderHouseNumber,
      } : {}),
    }));
    if (u.address?.lat) setSenderMapAddress(u.address);
    setUserSuggestions([]);
    setActiveField(null);
  };

  const handlePickupChange = (e) => {
    const { name, value } = e.target;
    setPickupForm((p) => ({ ...p, [name]: value }));
    if (name === 'fullName') { setActiveField('fullName'); filterSuggestions('fullName', value); }
  };

  const steps = orderType ? PICKUP_STEPS : [];
  const totalSteps = steps.length;

  /* ─── Address select handlers ───────────────────────────────── */
  const handlePickupAddressSelect = (addr, forWho) => {
    if (forWho === 'sender') {
      setSenderMapAddress(addr);
      setPickupForm((p) => ({ ...p, senderCity: addr.city || p.senderCity, senderStreet: addr.street || p.senderStreet, senderHouseNumber: addr.houseNumber || p.senderHouseNumber }));
    } else {
      setReceiverMapAddress(addr);
      setPickupForm((p) => ({ ...p, receiverCity: addr.city || p.receiverCity, receiverStreet: addr.street || p.receiverStreet, receiverHouseNumber: addr.houseNumber || p.receiverHouseNumber }));
    }
  };

  /* ─── Validation per step ───────────────────────────────────── */
  const canProceed = () => {
    if (!orderType) return false;
    if (step === 1) return pickupForm.fullName.trim() && pickupForm.israeliPhone.trim();
    if (step === 2) return !!senderMapAddress;
    if (step === 3) return boxCounts.large + boxCounts.small > 0;
    return true;
  };

  /* ─── Submit helpers ─────────────────────────────────────────── */
  const resolveCoords = async (mapAddr, city, street, houseNumber) => {
    const unchanged = mapAddr &&
      String(city || '').trim() === String(mapAddr.city || '').trim() &&
      String(street || '').trim() === String(mapAddr.street || '').trim() &&
      String(houseNumber || '').trim() === String(mapAddr.houseNumber || '').trim();
    if (unchanged) return { lat: mapAddr.lat, lng: mapAddr.lng };
    const coords = await geocodeAddress({ city, street, houseNumber });
    return coords || (mapAddr ? { lat: mapAddr.lat, lng: mapAddr.lng } : null);
  };

  const createMissionForOrder = async (orderId, missionPayload) => {
    await fetch(`${API_BASE}/orders/${orderId}/missions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(missionPayload),
    });
  };

  const submitPickup = async () => {
    setSubmitting(true); setError('');
    try {
      const [sC, rC] = await Promise.all([
        resolveCoords(senderMapAddress, pickupForm.senderCity, pickupForm.senderStreet, pickupForm.senderHouseNumber),
        resolveCoords(receiverMapAddress, pickupForm.receiverCity, pickupForm.receiverStreet, pickupForm.receiverHouseNumber),
      ]);
      const senderAddr = { displayAddress: senderMapAddress?.displayAddress || [pickupForm.senderStreet, pickupForm.senderHouseNumber, pickupForm.senderCity].filter(Boolean).join(', '), lat: sC?.lat, lng: sC?.lng, city: pickupForm.senderCity, street: pickupForm.senderStreet, houseNumber: pickupForm.senderHouseNumber, apartment: pickupForm.senderApartment, floor: pickupForm.senderFloor, videoUrl: senderMapAddress?.videoUrl, imageUrl: senderMapAddress?.imageUrl };
      const receiverAddr = { displayAddress: receiverMapAddress?.displayAddress || [pickupForm.receiverStreet, pickupForm.receiverHouseNumber, pickupForm.receiverCity].filter(Boolean).join(', '), lat: rC?.lat, lng: rC?.lng, city: pickupForm.receiverCity, street: pickupForm.receiverStreet, houseNumber: pickupForm.receiverHouseNumber, apartment: pickupForm.receiverApartment, floor: pickupForm.receiverFloor, videoUrl: receiverMapAddress?.videoUrl, imageUrl: receiverMapAddress?.imageUrl };
      const totalBoxes = boxCounts.large + boxCounts.small;
      const res = await fetch(`${API_BASE}/orders`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: orderType,
          boxes: totalBoxes,
          boxSelection: { large: boxCounts.large, small: boxCounts.small },
          createdBy: 'customer_service', contacted: true, status: 'linewhel_transferred',
          customerPhone: pickupForm.israeliPhone, fullName: pickupForm.fullName,
          senderAddress: senderAddr,
          receiverName: pickupForm.receiverName || undefined,
          receiverPhone: pickupForm.receiverPhone || undefined,
          receiverAddress: (pickupForm.receiverName || receiverMapAddress) ? receiverAddr : undefined,
        }),
      });
      if (!res.ok) throw new Error('Save error');
      const order = await res.json();
      if (createMission) {
        const missionAddr = { label: 'Pickup address', ...senderAddr };
        await createMissionForOrder(order.id, {
          type: 'ready_for_box',
          status: 'received',
          addresses: [missionAddr],
          pickupLocation: missionAddr,
          customerDetails: {
            name: pickupForm.fullName,
            phone: pickupForm.israeliPhone,
          },
          largeBoxes: boxCounts.large,
          smallBoxes: boxCounts.small,
        });
      }
      // Save/update sender as a user
      fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: pickupForm.fullName.trim(),
          phone:    pickupForm.israeliPhone.trim(),
          address:  senderAddr,
        }),
      }).catch(() => {});
      onCreated?.(order);
      handleClose();
    } catch (e) { setError(e.message || 'Error'); }
    finally { setSubmitting(false); }
  };

  const handleClose = () => {
    setOrderType(null); setStep(1); setError('');
    setPickupForm({ israeliPhone: '', fullName: '', senderCity: '', senderStreet: '', senderHouseNumber: '', senderApartment: '', senderFloor: '', receiverName: '', receiverPhone: '', receiverCity: '', receiverStreet: '', receiverHouseNumber: '', receiverApartment: '', receiverFloor: '' });
    setSenderMapAddress(null); setReceiverMapAddress(null); setAddressMapOpenFor(null);
    setBoxCounts({ large: 0, small: 0 });
    setCreateMission(false); setMissionLargeBoxes(''); setMissionSmallBoxes('');
    setUserSuggestions([]); setActiveField(null);
    onClose();
  };

  if (!isOpen) return null;

  /* ─── Render ─────────────────────────────────────────────────── */
  return (
    <>
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[95vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-800">
              {orderType === 'pickup' ? 'Pickup Order' : orderType === 'empty_box' ? 'Empty Box Order' : 'Create New Order'}
            </h2>
          </div>
          <button onClick={handleClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">

          {/* ── Type Selection ── */}
          {!orderType && (
            <div>
              <p className="text-slate-500 text-sm mb-5">Select order type:</p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setOrderType('empty_box')}
                  className="p-6 rounded-xl border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 flex flex-col items-center gap-3 transition-all"
                >
                  <Package className="w-10 h-10 text-indigo-500" />
                  <span className="font-semibold text-slate-800">Empty Box</span>
                  <span className="text-xs text-slate-500 text-center">Send empty boxes to customer address</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOrderType('pickup')}
                  className="p-6 rounded-xl border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 flex flex-col items-center gap-3 transition-all"
                >
                  <Truck className="w-10 h-10 text-indigo-500" />
                  <span className="font-semibold text-slate-800">Pickup Box</span>
                  <span className="text-xs text-slate-500 text-center">Pick up packed boxes from customer</span>
                </button>
              </div>
            </div>
          )}

          {/* ── Steps ── */}
          {orderType && <div>
              <StepBar steps={steps} current={step} />

              {/* ── Steps (shared for both pickup and empty_box) ── */}
              {orderType && (
                <>
                  {step === 1 && (
                    <div className="space-y-4" ref={suggestRef}>
                      <h3 className="font-semibold text-slate-800 text-base mb-1">Sender Details</h3>
                      <Field label="Israeli phone" required>
                        <div className="relative">
                          <PhoneInput
                            value={pickupForm.israeliPhone}
                            onChange={(v) => {
                              setPickupForm((p) => ({ ...p, israeliPhone: v }));
                              setActiveField('israeliPhone');
                              filterSuggestions('israeliPhone', v);
                            }}
                            onFocus={() => { setActiveField('israeliPhone'); filterSuggestions('israeliPhone', pickupForm.israeliPhone); }}
                            placeholder="501234567"
                            autoComplete="off"
                          />
                          {activeField === 'israeliPhone' && userSuggestions.length > 0 && (
                            <SuggestionDropdown suggestions={userSuggestions} onSelect={applySuggestion} />
                          )}
                        </div>
                      </Field>
                      <Field label="Full name" required>
                        <div className="relative">
                          <input
                            className={inputCls} name="fullName" value={pickupForm.fullName}
                            onChange={handlePickupChange}
                            onFocus={() => { setActiveField('fullName'); filterSuggestions('fullName', pickupForm.fullName); }}
                            placeholder="Full name"
                            autoComplete="off"
                          />
                          {activeField === 'fullName' && userSuggestions.length > 0 && (
                            <SuggestionDropdown suggestions={userSuggestions} onSelect={applySuggestion} />
                          )}
                        </div>
                      </Field>
                    </div>
                  )}

                  {step === 2 && (
                    <div className="space-y-4">
                      <h3 className="font-semibold text-slate-800 text-base mb-1">Pickup Address</h3>
                      <AddressBlock
                        mapAddr={senderMapAddress}
                        form={{ senderCity: pickupForm.senderCity, senderStreet: pickupForm.senderStreet, senderHouseNumber: pickupForm.senderHouseNumber, senderApartment: pickupForm.senderApartment, senderFloor: pickupForm.senderFloor }}
                        prefix="sender"
                        onMap={() => setAddressMapOpenFor('sender')}
                        onClear={() => { setSenderMapAddress(null); setPickupForm((p) => ({ ...p, senderCity: '', senderStreet: '', senderHouseNumber: '' })); }}
                      />
                    </div>
                  )}

                  {step === 3 && (
                    <div className="space-y-4">
                      <h3 className="font-semibold text-slate-800 text-base mb-1">Box Selection</h3>
                      <p className="text-sm text-slate-500 -mt-2">Select at least one box to continue.</p>
                      <div className="space-y-3">
                        {BOX_TYPES.map((bt) => {
                          const count = boxCounts[bt.id];
                          const BtIcon = bt.icon;
                          return (
                            <div key={bt.id} className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${count > 0 ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-white'}`}>
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${count > 0 ? 'bg-indigo-100' : 'bg-slate-100'}`}>
                                <BtIcon className={`w-6 h-6 ${count > 0 ? 'text-indigo-600' : 'text-slate-400'}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-slate-800 text-sm">{bt.label}</p>
                                <p className="text-xs text-slate-500">{bt.sub}</p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <button type="button" onClick={() => changeBoxCount(bt.id, -1)} disabled={count === 0}
                                  className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center disabled:opacity-30 hover:bg-indigo-700 transition">
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="w-7 text-center font-bold text-slate-800 text-base">{count}</span>
                                <button type="button" onClick={() => changeBoxCount(bt.id, 1)}
                                  className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 transition">
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {(boxCounts.large + boxCounts.small) > 0 && (
                        <p className="text-sm font-medium text-indigo-700 bg-indigo-50 px-3 py-2 rounded-lg">
                          Total: {boxCounts.large + boxCounts.small} boxes
                          {boxCounts.large > 0 && ` · ${boxCounts.large} Large`}
                          {boxCounts.small > 0 && ` · ${boxCounts.small} Small`}
                        </p>
                      )}
                    </div>
                  )}

                  {step === 4 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-slate-800 text-base">Receiver Details</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">optional</span>
                      </div>
                      <Field label="Full name">
                        <input className={inputCls} name="receiverName" value={pickupForm.receiverName} onChange={handlePickupChange} placeholder="Receiver name" />
                      </Field>
                      <Field label="Phone">
                        <input className={inputCls} name="receiverPhone" type="tel" value={pickupForm.receiverPhone} onChange={handlePickupChange} placeholder="050-9876543" />
                      </Field>
                    </div>
                  )}

                  {step === 5 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-slate-800 text-base">Delivery Address</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">optional</span>
                      </div>
                      <AddressBlock
                        mapAddr={receiverMapAddress}
                        form={{ receiverCity: pickupForm.receiverCity, receiverStreet: pickupForm.receiverStreet, receiverHouseNumber: pickupForm.receiverHouseNumber, receiverApartment: pickupForm.receiverApartment, receiverFloor: pickupForm.receiverFloor }}
                        prefix="receiver"
                        onMap={() => setAddressMapOpenFor('receiver')}
                        onClear={() => { setReceiverMapAddress(null); setPickupForm((p) => ({ ...p, receiverCity: '', receiverStreet: '', receiverHouseNumber: '' })); }}
                      />
                    </div>
                  )}

                  {step === 6 && (
                    <div className="space-y-3">
                      <h3 className="font-semibold text-slate-800 text-base mb-1">Order Summary</h3>
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Sender</p>
                        <SummaryRow label="Name" value={pickupForm.fullName} />
                        <SummaryRow label="Phone" value={pickupForm.israeliPhone} />
                        <SummaryRow label="Pickup address" value={senderMapAddress?.displayAddress || [pickupForm.senderStreet, pickupForm.senderHouseNumber, pickupForm.senderCity].filter(Boolean).join(', ')} />
                      </div>
                      {(pickupForm.receiverName || pickupForm.receiverPhone || receiverMapAddress) && (
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Receiver</p>
                          <SummaryRow label="Name" value={pickupForm.receiverName} />
                          <SummaryRow label="Phone" value={pickupForm.receiverPhone} />
                          <SummaryRow label="Delivery address" value={receiverMapAddress?.displayAddress || [pickupForm.receiverStreet, pickupForm.receiverHouseNumber, pickupForm.receiverCity].filter(Boolean).join(', ')} />
                        </div>
                      )}
                      <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 space-y-2">
                        <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-2">Boxes</p>
                        {boxCounts.large > 0 && <SummaryRow label="ISA-BOX-70 (Large)" value={String(boxCounts.large)} />}
                        {boxCounts.small > 0 && <SummaryRow label="ISA-BOX-35 (Small)" value={String(boxCounts.small)} />}
                        <SummaryRow label="Total" value={String(boxCounts.large + boxCounts.small)} />
                      </div>
                      <MissionCheckbox checked={createMission} onChange={setCreateMission} missionType="ready_for_box" />
                    </div>
                  )}
                </>
              )}

              {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
            </div>}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t flex-shrink-0 bg-white">
            <button
              type="button"
              onClick={() => !orderType ? handleClose() : step > 1 ? setStep((s) => s - 1) : setOrderType(null)}
              className="flex items-center gap-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              {!orderType ? 'Cancel' : step > 1 ? 'Back' : 'Back'}
            </button>
            {orderType && (step < totalSteps ? (
              <button
                type="button"
                disabled={!canProceed()}
                onClick={() => setStep((s) => s + 1)}
                className="flex-1 flex items-center justify-center gap-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={submitPickup}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                {submitting ? 'Saving...' : 'Create Order'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Address map picker */}
      <AddressPicker
        isOpen={!!addressMapOpenFor}
        onClose={() => setAddressMapOpenFor(null)}
        onSelect={(addr) => {
          if (addressMapOpenFor === 'sender') handlePickupAddressSelect(addr, 'sender');
          else if (addressMapOpenFor === 'receiver') handlePickupAddressSelect(addr, 'receiver');
          setAddressMapOpenFor(null);
        }}
        initialPosition={
          addressMapOpenFor === 'sender' && senderMapAddress?.lat != null ? [senderMapAddress.lat, senderMapAddress.lng] :
          addressMapOpenFor === 'receiver' && receiverMapAddress?.lat != null ? [receiverMapAddress.lat, receiverMapAddress.lng] :
          undefined
        }
      />
    </>
  );
}
