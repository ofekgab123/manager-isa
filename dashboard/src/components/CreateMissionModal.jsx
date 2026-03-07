import { useState, useEffect, useRef } from 'react';
import { X, Package, Truck, MapPin, User, Home, CheckCircle, ChevronRight, ChevronLeft, Box, Plus, Minus } from 'lucide-react';
import AddressPicker from './AddressPicker';
import PhoneInput from './PhoneInput';
import { geocodeAddress } from '../utils/geocode';
import { API_BASE } from '../config';

const BOX_TYPES = [
  { id: 'large', label: 'ISA-BOX-70', sub: 'Large – 45×45×70 cm · up to 50 kg', icon: Box,     color: 'indigo' },
  { id: 'small', label: 'ISA-BOX-35', sub: 'Small – 45×45×35 cm · up to 30 kg', icon: Package, color: 'blue'   },
];

const MISSION_STEPS = [
  { id: 1, label: 'Details',  icon: User },
  { id: 2, label: 'Address',  icon: Home },
  { id: 3, label: 'Boxes',    icon: Package },
  { id: 4, label: 'Summary',  icon: CheckCircle },
];

function StepBar({ current }) {
  return (
    <div className="flex items-center gap-0 mb-6">
      {MISSION_STEPS.map((s, i) => {
        const done   = current > s.id;
        const active = current === s.id;
        const Icon   = s.icon;
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
            {i < MISSION_STEPS.length - 1 && (
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

const inputCls  = 'w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 transition';
const readonlyCls = 'w-full px-3 py-2.5 border border-slate-100 rounded-xl text-sm bg-slate-50 text-slate-500 cursor-default';

function AddressBlock({ mapAddr, form, onMap, onClear }) {
  const city   = form.senderCity        || '';
  const street = form.senderStreet      || '';
  const house  = form.senderHouseNumber || '';
  const apt    = form.senderApartment   || '';
  const floor  = form.senderFloor       || '';
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
        <Field label="City"><input className={mapAddr ? inputCls : readonlyCls} readOnly={!mapAddr} value={city}   onChange={() => {}} placeholder="From map" /></Field>
        <Field label="Street"><input className={mapAddr ? inputCls : readonlyCls} readOnly={!mapAddr} value={street} onChange={() => {}} placeholder="From map" /></Field>
        <Field label="House no."><input className={mapAddr ? inputCls : readonlyCls} readOnly={!mapAddr} value={house}  onChange={() => {}} placeholder="From map" /></Field>
        <Field label="Apartment"><input className={inputCls} value={apt}   onChange={() => {}} placeholder="3" /></Field>
        <Field label="Floor"><input className={inputCls}     value={floor} onChange={() => {}} placeholder="2" /></Field>
      </div>
    </div>
  );
}

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

function SummaryRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-slate-500 w-32 flex-shrink-0">{label}</span>
      <span className="text-slate-800 font-medium">{value}</span>
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col max-h-[70vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-bold text-slate-800">Select Affiliate</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-4 py-3 border-b">
          <input
            autoFocus
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            placeholder="Search affiliate..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <ul className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filtered.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-400">No affiliates found</li>}
          {filtered.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onSelect(a); }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 text-left transition-colors"
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

export default function CreateMissionModal({ isOpen, onClose, onCreated }) {
  const [missionType, setMissionType] = useState(null); // null | 'pickup' | 'empty_box'
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [mapOpen, setMapOpen] = useState(false);

  /* ─── Affiliate ──────────────────────────────────────── */
  const [viaAffiliate, setViaAffiliate] = useState(false);
  const [selectedAffiliate, setSelectedAffiliate] = useState(null);
  const [affiliatePickerOpen, setAffiliatePickerOpen] = useState(false);

  const [form, setForm] = useState({
    fullName: '', israeliPhone: '',
    senderCity: '', senderStreet: '', senderHouseNumber: '', senderApartment: '', senderFloor: '',
  });
  const [mapAddress, setMapAddress] = useState(null);
  const [boxCounts, setBoxCounts] = useState({ large: 0, small: 0 });
  // pickup only: null = not answered, true = bring boxes, false = no boxes needed
  const [bringBoxes, setBringBoxes] = useState(null);
  // pickup only: how many boxes to collect from customer (null = not yet set)
  const [pickupBoxCount, setPickupBoxCount] = useState(null);
  const [pickupBoxCountInput, setPickupBoxCountInput] = useState('');

  /* ─── User autocomplete ──────────────────────────────── */
  const [allUsers, setAllUsers]           = useState([]);
  const [userSuggestions, setUserSuggestions] = useState([]);
  const [activeField, setActiveField]     = useState(null); // 'fullName' | 'israeliPhone'
  const suggestRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    fetch(`${API_BASE}/users`).then((r) => r.json()).then(setAllUsers).catch(() => {});
  }, [isOpen]);

  // Close dropdown when clicking outside
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

  const filterSuggestions = (name, value) => {
    if (!value.trim()) { setUserSuggestions([]); return; }
    const q = value.toLowerCase();
    const matches = allUsers.filter((u) => {
      if (name === 'fullName')     return (u.fullName || '').toLowerCase().includes(q);
      if (name === 'israeliPhone') return (u.phone   || '').replace(/\D/g, '').includes(q.replace(/\D/g, ''));
      return false;
    });
    setUserSuggestions(matches.slice(0, 6));
  };

  const applySuggestion = (u) => {
    setForm((p) => ({ ...p, fullName: u.fullName || p.fullName, israeliPhone: u.phone || p.israeliPhone }));
    if (u.address?.lat) {
      setMapAddress(u.address);
      setForm((p) => ({
        ...p,
        fullName: u.fullName || p.fullName,
        israeliPhone: u.phone || p.israeliPhone,
        senderCity:        u.address.city        || p.senderCity,
        senderStreet:      u.address.street      || p.senderStreet,
        senderHouseNumber: u.address.houseNumber || p.senderHouseNumber,
      }));
    }
    setUserSuggestions([]);
    setActiveField(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    setActiveField(name);
    filterSuggestions(name, value);
  };

  const totalSteps = MISSION_STEPS.length;

  const handleAddressSelect = (addr) => {
    setMapAddress(addr);
    setForm((p) => ({
      ...p,
      senderCity:        addr.city        || p.senderCity,
      senderStreet:      addr.street      || p.senderStreet,
      senderHouseNumber: addr.houseNumber || p.senderHouseNumber,
    }));
  };

  const canProceed = () => {
    if (!missionType) return false;
    if (step === 1) return form.fullName.trim() && form.israeliPhone.trim();
    if (step === 2) return !!mapAddress;
    if (step === 3) {
      if (missionType === 'pickup') {
        // sub-step 1: entering pickup box count
        if (pickupBoxCount === null) {
          const v = parseInt(pickupBoxCountInput);
          return pickupBoxCountInput.trim() !== '' && !isNaN(v) && v >= 0;
        }
        // sub-step 2: yes/no — must click a button, cannot use Next
        if (bringBoxes === null) return false;
        if (bringBoxes === false) return true;
        return boxCounts.large + boxCounts.small > 0;
      }
      return boxCounts.large + boxCounts.small > 0;
    }
    return true;
  };

  const handleNext = () => {
    // step 3 pickup sub-step: confirm pickup box count, stay on step 3
    if (step === 3 && missionType === 'pickup' && pickupBoxCount === null) {
      setPickupBoxCount(parseInt(pickupBoxCountInput) || 0);
      return;
    }
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    if (!missionType) { handleClose(); return; }
    if (step === 3 && missionType === 'pickup') {
      if (bringBoxes === true) { setBringBoxes(null); setBoxCounts({ large: 0, small: 0 }); return; }
      if (bringBoxes === null && pickupBoxCount !== null) { setPickupBoxCount(null); setPickupBoxCountInput(''); return; }
    }
    if (step > 1) setStep((s) => s - 1);
    else setMissionType(null);
  };

  const handleSubmit = async () => {
    setSubmitting(true); setError('');
    try {
      const coords = mapAddress ? { lat: mapAddress.lat, lng: mapAddress.lng } : await geocodeAddress({ city: form.senderCity, street: form.senderStreet, houseNumber: form.senderHouseNumber });
      const address = {
        displayAddress: mapAddress?.displayAddress || [form.senderStreet, form.senderHouseNumber, form.senderCity].filter(Boolean).join(', '),
        lat:  coords?.lat,
        lng:  coords?.lng,
        city: form.senderCity,
        street: form.senderStreet,
        houseNumber: form.senderHouseNumber,
        apartment: form.senderApartment,
        floor: form.senderFloor,
      };
      const res = await fetch(`${API_BASE}/missions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: missionType,
          fullName: form.fullName.trim(),
          customerPhone: form.israeliPhone.trim(),
          address,
          boxSelection: { large: boxCounts.large, small: boxCounts.small },
          bringBoxes: bringBoxes !== false,
          pickupBoxCount: missionType === 'pickup' ? (pickupBoxCount ?? 0) : null,
          createdBy: 'customer_service',
          affiliateName: viaAffiliate && selectedAffiliate ? selectedAffiliate.name : null,
          discountAmount: viaAffiliate && selectedAffiliate ? selectedAffiliate.discountAmount : null,
        }),
      });
      if (!res.ok) throw new Error('Save error');
      const mission = await res.json();
      // Save sender as a user (fire-and-forget)
      fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          phone:    form.israeliPhone.trim(),
          address,
        }),
      }).catch(() => {});
      onCreated?.(mission);
      handleClose();
    } catch (e) {
      setError(e.message || 'Error saving mission');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setMissionType(null); setStep(1); setError('');
    setForm({ fullName: '', israeliPhone: '', senderCity: '', senderStreet: '', senderHouseNumber: '', senderApartment: '', senderFloor: '' });
    setMapAddress(null); setBoxCounts({ large: 0, small: 0 }); setBringBoxes(null);
    setPickupBoxCount(null); setPickupBoxCountInput('');
    setViaAffiliate(false); setSelectedAffiliate(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
        <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[95vh]">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0">
            <h2 className="text-lg font-bold text-slate-800">
              {missionType === 'pickup' ? 'Pickup Mission' : missionType === 'empty_box' ? 'Empty Box Mission' : 'Create New Mission'}
            </h2>
            <button onClick={handleClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-5">

            {/* Type selection */}
            {!missionType && (
              <div>
                <p className="text-slate-500 text-sm mb-5">Select mission type:</p>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setMissionType('empty_box')}
                    className="p-6 rounded-xl border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 flex flex-col items-center gap-3 transition-all"
                  >
                    <Package className="w-10 h-10 text-indigo-500" />
                    <span className="font-semibold text-slate-800">Empty Box</span>
                    <span className="text-xs text-slate-500 text-center">Send empty boxes to customer address</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMissionType('pickup')}
                    className="p-6 rounded-xl border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 flex flex-col items-center gap-3 transition-all"
                  >
                    <Truck className="w-10 h-10 text-indigo-500" />
                    <span className="font-semibold text-slate-800">Pickup Box</span>
                    <span className="text-xs text-slate-500 text-center">Pick up packed boxes from customer</span>
                  </button>
                </div>
              </div>
            )}

            {/* Steps */}
            {missionType && (
              <div>
                <StepBar current={step} />

                {step === 1 && (
                  <div className="space-y-4" ref={suggestRef}>
                    <h3 className="font-semibold text-slate-800 text-base mb-1">Sender Details</h3>

                    {/* Phone with autocomplete */}
                    <Field label="Phone" required>
                      <div className="relative">
                        <PhoneInput
                          value={form.israeliPhone}
                          onChange={(v) => {
                            setForm((p) => ({ ...p, israeliPhone: v }));
                            setActiveField('israeliPhone');
                            filterSuggestions('israeliPhone', v);
                          }}
                          onFocus={() => { setActiveField('israeliPhone'); filterSuggestions('israeliPhone', form.israeliPhone); }}
                          placeholder="501234567"
                          autoComplete="off"
                        />
                        {activeField === 'israeliPhone' && userSuggestions.length > 0 && (
                          <SuggestionDropdown suggestions={userSuggestions} onSelect={applySuggestion} />
                        )}
                      </div>
                    </Field>

                    {/* Full name with autocomplete */}
                    <Field label="Full name" required>
                      <div className="relative">
                        <input
                          className={inputCls} name="fullName" value={form.fullName}
                          onChange={handleChange}
                          onFocus={() => { setActiveField('fullName'); filterSuggestions('fullName', form.fullName); }}
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
                    <h3 className="font-semibold text-slate-800 text-base mb-1">Address</h3>
                    <AddressBlock
                      mapAddr={mapAddress}
                      form={form}
                      onMap={() => setMapOpen(true)}
                      onClear={() => { setMapAddress(null); setForm((p) => ({ ...p, senderCity: '', senderStreet: '', senderHouseNumber: '' })); }}
                    />
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-4">
                    {missionType === 'pickup' && pickupBoxCount === null ? (
                      <>
                        <h3 className="font-semibold text-slate-800 text-base mb-1">Boxes to collect</h3>
                        <p className="text-sm text-slate-500 -mt-2">How many boxes are we picking up from the customer?</p>
                        <input
                          type="number" min="0"
                          value={pickupBoxCountInput}
                          onChange={(e) => setPickupBoxCountInput(e.target.value)}
                          placeholder="0"
                          className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-lg font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 text-center"
                          autoFocus
                        />
                      </>
                    ) : missionType === 'pickup' && bringBoxes === null ? (
                      <>
                        <h3 className="font-semibold text-slate-800 text-base mb-1">Boxes</h3>
                        <p className="text-sm text-slate-500 -mt-2">Does the customer need empty boxes delivered?</p>
                        <div className="grid grid-cols-2 gap-3 mt-2">
                          <button
                            type="button"
                            onClick={() => setBringBoxes(true)}
                            className="p-5 rounded-xl border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 flex flex-col items-center gap-2 transition-all"
                          >
                            <Package className="w-8 h-8 text-indigo-500" />
                            <span className="font-semibold text-slate-800 text-sm">Yes</span>
                            <span className="text-xs text-slate-500 text-center">Bring empty boxes to customer</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => { setBringBoxes(false); setBoxCounts({ large: 0, small: 0 }); setStep(4); }}
                            className="p-5 rounded-xl border-2 border-slate-200 hover:border-slate-400 hover:bg-slate-50 flex flex-col items-center gap-2 transition-all"
                          >
                            <Truck className="w-8 h-8 text-slate-400" />
                            <span className="font-semibold text-slate-800 text-sm">No</span>
                            <span className="text-xs text-slate-500 text-center">Customer doesn't need additional boxes</span>
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-slate-800 text-base">Box Selection</h3>
                          {missionType === 'pickup' && (
                            <button type="button" onClick={() => { setBringBoxes(null); setBoxCounts({ large: 0, small: 0 }); }}
                              className="text-xs text-indigo-600 hover:underline">Change</button>
                          )}
                        </div>
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
                                  <button type="button" onClick={() => setBoxCounts((p) => ({ ...p, [bt.id]: Math.max(0, p[bt.id] - 1) }))} disabled={count === 0}
                                    className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center disabled:opacity-30 hover:bg-indigo-700 transition">
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <span className="w-7 text-center font-bold text-slate-800 text-base">{count}</span>
                                  <button type="button" onClick={() => setBoxCounts((p) => ({ ...p, [bt.id]: p[bt.id] + 1 }))}
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
                      </>
                    )}
                  </div>
                )}

                {step === 4 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-slate-800 text-base mb-1">Mission Summary</h3>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Details</p>
                      <SummaryRow label="Name"  value={form.fullName} />
                      <SummaryRow label="Phone" value={form.israeliPhone} />
                      <SummaryRow label="Type"  value={missionType === 'pickup' ? 'Pickup Box' : 'Empty Box'} />
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Address</p>
                      <SummaryRow label="Address" value={mapAddress?.displayAddress || [form.senderStreet, form.senderHouseNumber, form.senderCity].filter(Boolean).join(', ')} />
                      {form.senderApartment && <SummaryRow label="Apt"   value={form.senderApartment} />}
                      {form.senderFloor     && <SummaryRow label="Floor" value={form.senderFloor} />}
                    </div>
                    {(missionType !== 'pickup' || bringBoxes !== false) && (
                      <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 space-y-2">
                        <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-2">Boxes</p>
                        {boxCounts.large > 0 && <SummaryRow label="ISA-BOX-70 (Large)" value={String(boxCounts.large)} />}
                        {boxCounts.small > 0 && <SummaryRow label="ISA-BOX-35 (Small)" value={String(boxCounts.small)} />}
                        <SummaryRow label="Total" value={String(boxCounts.large + boxCounts.small)} />
                      </div>
                    )}
                    {missionType === 'pickup' && (
                      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                        <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">Pickup from customer</p>
                        <SummaryRow label="Boxes to collect" value={String(pickupBoxCount ?? 0)} />
                      </div>
                    )}
                    {missionType === 'pickup' && bringBoxes === false && (
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Empty boxes delivery</p>
                        <p className="text-sm text-slate-500">Customer doesn't need additional boxes</p>
                      </div>
                    )}

                    {/* Affiliate */}
                    <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${viaAffiliate ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50'}`}>
                      <input
                        type="checkbox"
                        checked={viaAffiliate}
                        onChange={(e) => { setViaAffiliate(e.target.checked); if (!e.target.checked) setSelectedAffiliate(null); }}
                        className="mt-0.5 w-4 h-4 accent-indigo-600 cursor-pointer flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800">Came via affiliate</p>
                        <p className="text-xs text-slate-500 mt-0.5">Associate this mission with an affiliate</p>
                      </div>
                    </label>

                    {viaAffiliate && (
                      <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3">
                        {selectedAffiliate ? (
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-slate-800">{selectedAffiliate.name}</p>
                              <p className="text-xs text-slate-500">{selectedAffiliate.promoCode}{selectedAffiliate.discountAmount ? ` · ₪${selectedAffiliate.discountAmount} discount` : ''}</p>
                            </div>
                            <button type="button" onClick={() => setAffiliatePickerOpen(true)} className="text-xs text-indigo-600 hover:underline shrink-0">Change</button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setAffiliatePickerOpen(true)}
                            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 rounded-lg transition-colors"
                          >
                            Select affiliate
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-5 py-4 border-t flex-shrink-0 bg-white">
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              {!missionType ? 'Cancel' : 'Back'}
            </button>
            {missionType && (step < totalSteps ? (
              <button
                type="button"
                disabled={!canProceed()}
                onClick={handleNext}
                className="flex-1 flex items-center justify-center gap-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmit}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                {submitting ? 'Saving...' : 'Create Mission'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <AddressPicker
        isOpen={mapOpen}
        onClose={() => setMapOpen(false)}
        onSelect={(addr) => { handleAddressSelect(addr); setMapOpen(false); }}
        initialPosition={mapAddress?.lat != null ? [mapAddress.lat, mapAddress.lng] : undefined}
      />

      <AffiliatePickerModal
        isOpen={affiliatePickerOpen}
        onClose={() => setAffiliatePickerOpen(false)}
        onSelect={(a) => { setSelectedAffiliate(a); setAffiliatePickerOpen(false); }}
      />
    </>
  );
}
