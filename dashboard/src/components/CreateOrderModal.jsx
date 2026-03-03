import { useState } from 'react';
import { X, Package, Truck, MapPin, User, Home, FileText, CheckCircle, ChevronRight, ChevronLeft, ClipboardList, Box } from 'lucide-react';
import AddressSearch from './AddressSearch';
import AddressPicker from './AddressPicker';
import { geocodeAddress } from '../utils/geocode';
import { API_BASE } from '../config';

/* ─── Step definitions ───────────────────────────────────────── */
const EMPTY_BOX_STEPS = [
  { id: 1, label: 'Customer Details', icon: User },
  { id: 2, label: 'Address',          icon: Home },
  { id: 3, label: 'Notes',            icon: FileText },
  { id: 4, label: 'Summary',          icon: CheckCircle },
];

const PICKUP_STEPS = [
  { id: 1, label: 'Sender Details',   icon: User },
  { id: 2, label: 'Pickup Address',   icon: Home },
  { id: 3, label: 'Receiver Details', icon: User },
  { id: 4, label: 'Delivery Address', icon: Home },
  { id: 5, label: 'Summary',          icon: CheckCircle },
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

function AddressBlock({ mapAddr, form, prefix, onSearch, onMap, onClear }) {
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
        <div className="flex flex-col sm:flex-row gap-2">
          <button type="button" onClick={onSearch}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed border-slate-300 rounded-xl text-sm text-slate-600 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all">
            <MapPin className="w-4 h-4" />
            Search address
          </button>
          <button type="button" onClick={onMap}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed border-slate-300 rounded-xl text-sm text-slate-600 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all">
            <MapPin className="w-4 h-4" />
            Pick on map
          </button>
        </div>
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
  const [orderType, setOrderType] = useState(null); // 'pickup' | 'empty_box'
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [addressPickerFor, setAddressPickerFor] = useState(null); // 'sender' | 'receiver' | 'empty_box'
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

  // Empty box form
  const [emptyBoxForm, setEmptyBoxForm] = useState({
    firstName: '', lastName: '', phone: '',
    city: '', streetName: '', houseNumber: '', apartment: '', floor: '',
    orderNotes: '',
  });
  const [emptyBoxAddress, setEmptyBoxAddress] = useState(null);

  // Mission creation alongside order
  const [createMission, setCreateMission] = useState(false);
  const [missionLargeBoxes, setMissionLargeBoxes] = useState('');
  const [missionSmallBoxes, setMissionSmallBoxes] = useState('');

  const handlePickupChange = (e) => setPickupForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  const handleEmptyChange  = (e) => setEmptyBoxForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const steps = orderType === 'pickup' ? PICKUP_STEPS : EMPTY_BOX_STEPS;
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
    setAddressPickerFor(null);
  };

  const handleEmptyBoxAddressSelect = (addr) => {
    setEmptyBoxAddress(addr);
    setEmptyBoxForm((p) => ({ ...p, city: addr.city || p.city, streetName: addr.street || p.streetName, houseNumber: addr.houseNumber || p.houseNumber }));
  };

  /* ─── Validation per step ───────────────────────────────────── */
  const canProceed = () => {
    if (orderType === 'empty_box') {
      if (step === 1) return emptyBoxForm.firstName.trim() && emptyBoxForm.lastName.trim() && emptyBoxForm.phone.trim();
      if (step === 2) return !!emptyBoxAddress;
      return true;
    }
    if (orderType === 'pickup') {
      if (step === 1) return pickupForm.fullName.trim() && pickupForm.israeliPhone.trim();
      if (step === 2) return !!senderMapAddress;
      if (step === 3) return pickupForm.receiverName.trim() && pickupForm.receiverPhone.trim();
      if (step === 4) return !!receiverMapAddress;
      return true;
    }
    return false;
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

  const submitEmptyBox = async () => {
    setSubmitting(true); setError('');
    try {
      const { firstName, lastName, phone, city, streetName, houseNumber, apartment, floor, orderNotes } = emptyBoxForm;
      const coords = await resolveCoords(emptyBoxAddress, city, streetName, houseNumber);
      const address = emptyBoxAddress || { displayAddress: [streetName, houseNumber, city].filter(Boolean).join(', '), lat: coords?.lat, lng: coords?.lng, city, street: streetName, houseNumber };
      const fullAddress = { ...address, apartment, floor };
      const res = await fetch(`${API_BASE}/orders`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'empty_box', boxes: 0,
          address: fullAddress,
          customerPhone: phone.trim(),
          firstName: firstName.trim(), lastName: lastName.trim(),
          fullName: [firstName, lastName].filter(Boolean).join(' ').trim(),
          orderNotes: orderNotes.trim() || undefined,
          createdBy: 'customer_service', contacted: true, status: 'linewhel_transferred',
        }),
      });
      if (!res.ok) throw new Error('Save error');
      const order = await res.json();
      if (createMission) {
        await createMissionForOrder(order.id, {
          type: 'ready_for_box',
          status: 'received',
          addresses: [{ label: 'Order address', ...fullAddress }],
          customerDetails: { name: order.fullName || '', phone: phone.trim() },
          largeBoxes: parseInt(missionLargeBoxes) || 0,
          smallBoxes: parseInt(missionSmallBoxes) || 0,
        });
      }
      onCreated?.(order);
      handleClose();
    } catch (e) { setError(e.message || 'Error'); }
    finally { setSubmitting(false); }
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
      const res = await fetch(`${API_BASE}/orders`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'pickup', boxes: 0, createdBy: 'customer_service', contacted: true, status: 'linewhel_transferred',
          customerPhone: pickupForm.israeliPhone, fullName: pickupForm.fullName,
          senderAddress: senderAddr,
          receiverName: pickupForm.receiverName, receiverPhone: pickupForm.receiverPhone,
          receiverAddress: receiverAddr,
        }),
      });
      if (!res.ok) throw new Error('Save error');
      const order = await res.json();
      if (createMission) {
        await createMissionForOrder(order.id, {
          type: 'ready_for_pickup',
          status: 'received',
          pickupLocation: senderAddr,
          deliveryLocation: receiverAddr,
          customerDetails: {
            senderName: pickupForm.fullName,
            senderPhone: pickupForm.israeliPhone,
            receiverName: pickupForm.receiverName,
            receiverPhone: pickupForm.receiverPhone,
          },
        });
      }
      onCreated?.(order);
      handleClose();
    } catch (e) { setError(e.message || 'Error'); }
    finally { setSubmitting(false); }
  };

  const handleClose = () => {
    setOrderType(null); setStep(1); setError('');
    setPickupForm({ israeliPhone: '', fullName: '', senderCity: '', senderStreet: '', senderHouseNumber: '', senderApartment: '', senderFloor: '', receiverName: '', receiverPhone: '', receiverCity: '', receiverStreet: '', receiverHouseNumber: '', receiverApartment: '', receiverFloor: '' });
    setSenderMapAddress(null); setReceiverMapAddress(null);
    setEmptyBoxForm({ firstName: '', lastName: '', phone: '', city: '', streetName: '', houseNumber: '', apartment: '', floor: '', orderNotes: '' });
    setEmptyBoxAddress(null); setAddressMapOpenFor(null); setAddressPickerFor(null);
    setCreateMission(false); setMissionLargeBoxes(''); setMissionSmallBoxes('');
    onClose();
  };

  if (!isOpen) return null;

  /* ─── Render ─────────────────────────────────────────────────── */
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[95vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0">
          <div className="flex items-center gap-2">
            {orderType && (
              <button type="button" onClick={() => { setOrderType(null); setStep(1); }}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <h2 className="text-lg font-bold text-slate-800">
              {!orderType ? 'New Order' : orderType === 'pickup' ? 'Pickup' : 'Empty Box'}
            </h2>
          </div>
          <button onClick={handleClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">

          {/* ── Type selection ── */}
          {!orderType && (
            <div className="space-y-4">
              <p className="text-sm text-slate-500 mb-2">Select order type:</p>
              <button type="button" onClick={() => { setOrderType('empty_box'); setStep(1); }}
                className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all group text-right">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-200 transition-colors">
                  <Package className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 text-base">Empty Box</p>
                  <p className="text-sm text-slate-500 mt-0.5">Send empty boxes to customer for packing</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 ml-auto transition-colors" />
              </button>
              <button type="button" onClick={() => { setOrderType('pickup'); setStep(1); }}
                className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all group text-right">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-200 transition-colors">
                  <Truck className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 text-base">Pickup</p>
                  <p className="text-sm text-slate-500 mt-0.5">Pick up a parcel and send to receiver</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 ml-auto transition-colors" />
              </button>
            </div>
          )}

          {/* ── Steps ── */}
          {orderType && (
            <div>
              <StepBar steps={steps} current={step} />

              {/* ── Empty Box steps ── */}
              {orderType === 'empty_box' && (
                <>
                  {step === 1 && (
                    <div className="space-y-4">
                      <h3 className="font-semibold text-slate-800 text-base mb-1">Customer Details</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="First name" required>
                          <input className={inputCls} name="firstName" value={emptyBoxForm.firstName} onChange={handleEmptyChange} placeholder="First name" />
                        </Field>
                        <Field label="Last name" required>
                          <input className={inputCls} name="lastName" value={emptyBoxForm.lastName} onChange={handleEmptyChange} placeholder="Last name" />
                        </Field>
                      </div>
                      <Field label="Phone" required>
                        <input className={inputCls} name="phone" type="tel" value={emptyBoxForm.phone} onChange={handleEmptyChange} placeholder="050-1234567" />
                      </Field>
                    </div>
                  )}

                  {step === 2 && (
                    <div className="space-y-4">
                      <h3 className="font-semibold text-slate-800 text-base mb-1">Delivery Address</h3>
                      {addressPickerFor === 'empty_box' ? (
                        <div className="space-y-3">
                          <AddressSearch
                            value={emptyBoxAddress}
                            onChange={(addr) => { handleEmptyBoxAddressSelect(addr); setAddressPickerFor(null); }}
                            onClear={() => { setEmptyBoxAddress(null); setEmptyBoxForm((p) => ({ ...p, city: '', streetName: '', houseNumber: '' })); setAddressPickerFor(null); }}
                            placeholder="Search address..."
                          />
                          <button type="button" onClick={() => setAddressPickerFor(null)} className="text-sm text-slate-500 hover:text-slate-700">← Cancel</button>
                        </div>
                      ) : (
                        <AddressBlock
                          mapAddr={emptyBoxAddress}
                          form={emptyBoxForm}
                          prefix=""
                          onSearch={() => setAddressPickerFor('empty_box')}
                          onMap={() => setAddressMapOpenFor('empty_box')}
                          onClear={() => { setEmptyBoxAddress(null); setEmptyBoxForm((p) => ({ ...p, city: '', streetName: '', houseNumber: '' })); }}
                        />
                      )}
                    </div>
                  )}

                  {step === 3 && (
                    <div className="space-y-4">
                      <h3 className="font-semibold text-slate-800 text-base mb-1">Notes (optional)</h3>
                      <Field label="Order notes">
                        <textarea
                          name="orderNotes"
                          value={emptyBoxForm.orderNotes}
                          onChange={handleEmptyChange}
                          rows={4}
                          placeholder="Delivery notes, special instructions..."
                          className={inputCls + ' resize-none'}
                        />
                      </Field>
                    </div>
                  )}

                  {step === 4 && (
                    <div className="space-y-4">
                      <h3 className="font-semibold text-slate-800 text-base mb-1">Order Summary</h3>
                      <div className="space-y-3">
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Customer Details</p>
                          <SummaryRow label="Name" value={[emptyBoxForm.firstName, emptyBoxForm.lastName].filter(Boolean).join(' ')} />
                          <SummaryRow label="Phone" value={emptyBoxForm.phone} />
                        </div>
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Delivery Address</p>
                          <SummaryRow label="Address" value={emptyBoxAddress?.displayAddress} />
                          {emptyBoxForm.apartment && <SummaryRow label="Apt" value={emptyBoxForm.apartment} />}
                          {emptyBoxForm.floor && <SummaryRow label="Floor" value={emptyBoxForm.floor} />}
                        </div>
                        {emptyBoxForm.orderNotes && (
                          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Notes</p>
                            <p className="text-sm text-slate-700">{emptyBoxForm.orderNotes}</p>
                          </div>
                        )}

                        {/* Create mission checkbox */}
                        <MissionCheckbox
                          checked={createMission}
                          onChange={setCreateMission}
                          missionType="ready_for_box"
                        />
                        {createMission && (
                          <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 space-y-3">
                            <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5">
                              <Box className="w-3.5 h-3.5" />Box quantity for mission
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                              <Field label="ISA-BOX-70 (Large)">
                                <input type="number" min="0" value={missionLargeBoxes} onChange={(e) => setMissionLargeBoxes(e.target.value)} placeholder="0" className={inputCls} />
                              </Field>
                              <Field label="ISA-BOX-35 (Small)">
                                <input type="number" min="0" value={missionSmallBoxes} onChange={(e) => setMissionSmallBoxes(e.target.value)} placeholder="0" className={inputCls} />
                              </Field>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ── Pickup steps ── */}
              {orderType === 'pickup' && (
                <>
                  {step === 1 && (
                    <div className="space-y-4">
                      <h3 className="font-semibold text-slate-800 text-base mb-1">Sender Details</h3>
                      <Field label="Full name" required>
                        <input className={inputCls} name="fullName" value={pickupForm.fullName} onChange={handlePickupChange} placeholder="Full name" />
                      </Field>
                      <Field label="Israeli phone" required>
                        <input className={inputCls} name="israeliPhone" type="tel" value={pickupForm.israeliPhone} onChange={handlePickupChange} placeholder="050-1234567" />
                      </Field>
                    </div>
                  )}

                  {step === 2 && (
                    <div className="space-y-4">
                      <h3 className="font-semibold text-slate-800 text-base mb-1">Pickup Address</h3>
                      {addressPickerFor === 'sender' ? (
                        <div className="space-y-3">
                          <AddressSearch
                            value={senderMapAddress}
                            onChange={(addr) => { handlePickupAddressSelect(addr, 'sender'); setAddressPickerFor(null); }}
                            onClear={() => { setSenderMapAddress(null); setPickupForm((p) => ({ ...p, senderCity: '', senderStreet: '', senderHouseNumber: '' })); setAddressPickerFor(null); }}
                            placeholder="Search address..."
                          />
                          <button type="button" onClick={() => setAddressPickerFor(null)} className="text-sm text-slate-500 hover:text-slate-700">← Cancel</button>
                        </div>
                      ) : (
                        <AddressBlock
                          mapAddr={senderMapAddress}
                          form={{ senderCity: pickupForm.senderCity, senderStreet: pickupForm.senderStreet, senderHouseNumber: pickupForm.senderHouseNumber, senderApartment: pickupForm.senderApartment, senderFloor: pickupForm.senderFloor }}
                          prefix="sender"
                          onSearch={() => setAddressPickerFor('sender')}
                          onMap={() => setAddressMapOpenFor('sender')}
                          onClear={() => { setSenderMapAddress(null); setPickupForm((p) => ({ ...p, senderCity: '', senderStreet: '', senderHouseNumber: '' })); }}
                        />
                      )}
                    </div>
                  )}

                  {step === 3 && (
                    <div className="space-y-4">
                      <h3 className="font-semibold text-slate-800 text-base mb-1">Receiver Details</h3>
                      <Field label="Full name" required>
                        <input className={inputCls} name="receiverName" value={pickupForm.receiverName} onChange={handlePickupChange} placeholder="Receiver name" />
                      </Field>
                      <Field label="Phone" required>
                        <input className={inputCls} name="receiverPhone" type="tel" value={pickupForm.receiverPhone} onChange={handlePickupChange} placeholder="050-9876543" />
                      </Field>
                    </div>
                  )}

                  {step === 4 && (
                    <div className="space-y-4">
                      <h3 className="font-semibold text-slate-800 text-base mb-1">Delivery Address</h3>
                      {addressPickerFor === 'receiver' ? (
                        <div className="space-y-3">
                          <AddressSearch
                            value={receiverMapAddress}
                            onChange={(addr) => { handlePickupAddressSelect(addr, 'receiver'); setAddressPickerFor(null); }}
                            onClear={() => { setReceiverMapAddress(null); setPickupForm((p) => ({ ...p, receiverCity: '', receiverStreet: '', receiverHouseNumber: '' })); setAddressPickerFor(null); }}
                            placeholder="Search address..."
                          />
                          <button type="button" onClick={() => setAddressPickerFor(null)} className="text-sm text-slate-500 hover:text-slate-700">← Cancel</button>
                        </div>
                      ) : (
                        <AddressBlock
                          mapAddr={receiverMapAddress}
                          form={{ receiverCity: pickupForm.receiverCity, receiverStreet: pickupForm.receiverStreet, receiverHouseNumber: pickupForm.receiverHouseNumber, receiverApartment: pickupForm.receiverApartment, receiverFloor: pickupForm.receiverFloor }}
                          prefix="receiver"
                          onSearch={() => setAddressPickerFor('receiver')}
                          onMap={() => setAddressMapOpenFor('receiver')}
                          onClear={() => { setReceiverMapAddress(null); setPickupForm((p) => ({ ...p, receiverCity: '', receiverStreet: '', receiverHouseNumber: '' })); }}
                        />
                      )}
                    </div>
                  )}

                  {step === 5 && (
                    <div className="space-y-3">
                      <h3 className="font-semibold text-slate-800 text-base mb-1">Order Summary</h3>
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Sender</p>
                        <SummaryRow label="Name" value={pickupForm.fullName} />
                        <SummaryRow label="Phone" value={pickupForm.israeliPhone} />
                        <SummaryRow label="Pickup address" value={senderMapAddress?.displayAddress || [pickupForm.senderStreet, pickupForm.senderHouseNumber, pickupForm.senderCity].filter(Boolean).join(', ')} />
                      </div>
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Receiver</p>
                        <SummaryRow label="Name" value={pickupForm.receiverName} />
                        <SummaryRow label="Phone" value={pickupForm.receiverPhone} />
                        <SummaryRow label="Delivery address" value={receiverMapAddress?.displayAddress || [pickupForm.receiverStreet, pickupForm.receiverHouseNumber, pickupForm.receiverCity].filter(Boolean).join(', ')} />
                      </div>

                      {/* Create mission checkbox */}
                      <MissionCheckbox
                        checked={createMission}
                        onChange={setCreateMission}
                        missionType="ready_for_pickup"
                      />
                    </div>
                  )}
                </>
              )}

              {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        {orderType && (
          <div className="flex gap-3 px-5 py-4 border-t flex-shrink-0 bg-white">
            <button
              type="button"
              onClick={() => step > 1 ? setStep((s) => s - 1) : setOrderType(null)}
              className="flex items-center gap-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              {step > 1 ? 'Back' : 'Select type'}
            </button>
            {step < totalSteps ? (
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
                onClick={orderType === 'pickup' ? submitPickup : submitEmptyBox}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                {submitting ? 'Saving...' : 'Create Order'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Address map picker */}
      <AddressPicker
        isOpen={!!addressMapOpenFor}
        onClose={() => setAddressMapOpenFor(null)}
        onSelect={(addr) => {
          if (addressMapOpenFor === 'sender') handlePickupAddressSelect(addr, 'sender');
          else if (addressMapOpenFor === 'receiver') handlePickupAddressSelect(addr, 'receiver');
          else if (addressMapOpenFor === 'empty_box') handleEmptyBoxAddressSelect(addr);
          setAddressMapOpenFor(null);
        }}
        initialPosition={
          addressMapOpenFor === 'sender' && senderMapAddress?.lat != null ? [senderMapAddress.lat, senderMapAddress.lng] :
          addressMapOpenFor === 'receiver' && receiverMapAddress?.lat != null ? [receiverMapAddress.lat, receiverMapAddress.lng] :
          addressMapOpenFor === 'empty_box' && emptyBoxAddress?.lat != null ? [emptyBoxAddress.lat, emptyBoxAddress.lng] :
          undefined
        }
      />
    </div>
  );
}
