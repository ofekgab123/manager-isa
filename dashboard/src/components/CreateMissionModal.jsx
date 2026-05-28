import { useState, useEffect, useRef } from 'react';
import { X, Package, Truck, MapPin, User, Home, CheckCircle, ChevronRight, ChevronLeft, Box, Plus, Minus, Link2, Loader2 } from 'lucide-react';
import AddressPicker from './AddressPicker';
import PhoneInput from './PhoneInput';
import { authCountryToShippingDestination } from '../authCountryUtils';
import { SHIPPING_DESTINATIONS, shippingDestinationLabel, missionLwRegionId } from '../shippingDestinations';
import { geocodeAddress } from '../utils/geocode';
import { API_BASE } from '../config';
import EmptyBoxMissionPickerModal from './EmptyBoxMissionPickerModal';

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

function StepBar({ current, missionType }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {MISSION_STEPS.map((s, i) => {
        const done   = current > s.id;
        const active = current === s.id;
        const Icon   = s.icon;
        const optionalLabel = s.id === 3 && missionType === 'pickup';
        return (
          <div key={s.id} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-200 ${
                done   ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200' :
                active ? 'bg-white border-indigo-500 text-indigo-600 shadow-sm' :
                         'bg-white border-slate-200 text-slate-400'
              }`}>
                {done ? <CheckCircle className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>
              <span className={`text-[10px] font-semibold whitespace-nowrap ${
                active ? 'text-indigo-700' : done ? 'text-indigo-400' : 'text-slate-400'
              }`}>{s.label}</span>
              {optionalLabel && (
                <span className="text-[9px] text-slate-400 whitespace-nowrap">optional</span>
              )}
            </div>
            {i < MISSION_STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 mx-1.5 mb-5 rounded-full transition-colors duration-200 ${done ? 'bg-indigo-400' : 'bg-slate-200'}`} />
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
      <label className="label">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls  = 'input-field';
const readonlyCls = 'input-field bg-slate-50 text-slate-500 cursor-default';

function AddressBlock({ mapAddr, form, onMap, onClear, onFieldChange }) {
  const city   = form.senderCity        || '';
  const street = form.senderStreet      || '';
  const house  = form.senderHouseNumber || '';
  const apt    = form.senderApartment   || '';
  const floor  = form.senderFloor       || '';
  return (
    <div className="space-y-3">
      {mapAddr ? (
        <div className="flex items-start gap-3 p-3.5 bg-indigo-50/80 border border-indigo-200 rounded-xl">
          <MapPin className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">{mapAddr.displayAddress}</p>
            {mapAddr.lat != null && (
              <p className="text-xs font-mono text-slate-400">{Number(mapAddr.lat).toFixed(5)}, {Number(mapAddr.lng).toFixed(5)}</p>
            )}
          </div>
          <button type="button" onClick={onClear} className="action-btn hover:bg-red-50 text-slate-300 hover:text-red-500">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={onMap}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed border-slate-300 rounded-xl text-sm text-slate-600 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all duration-200">
          <MapPin className="w-4 h-4" />
          Pick on map
        </button>
      )}
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="City"><input className={mapAddr ? inputCls : readonlyCls} readOnly={!mapAddr} value={city}   onChange={() => {}} placeholder="From map" /></Field>
        <Field label="Street"><input className={mapAddr ? inputCls : readonlyCls} readOnly={!mapAddr} value={street} onChange={() => {}} placeholder="From map" /></Field>
        <Field label="House no."><input className={mapAddr ? inputCls : readonlyCls} readOnly={!mapAddr} value={house}  onChange={() => {}} placeholder="From map" /></Field>
        <Field label="Apartment"><input className={inputCls} name="senderApartment" value={apt} onChange={onFieldChange} placeholder="3" /></Field>
        <Field label="Floor"><input className={inputCls} name="senderFloor" value={floor} onChange={onFieldChange} placeholder="2" /></Field>
      </div>
    </div>
  );
}

function SuggestionDropdown({ suggestions, onSelect }) {
  return (
    <ul className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-white border border-slate-100 rounded-xl shadow-lg overflow-hidden animate-scale-in">
      {suggestions.map((u) => (
        <li key={u.id}>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); onSelect(u); }}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-indigo-50/70 transition-colors text-left"
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
    <div className="modal-overlay z-[70]">
      <div className="modal-content max-w-lg max-h-[80vh]">
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

export default function CreateMissionModal({ isOpen, onClose, onCreated, authCountry = null }) {
  const [missionType, setMissionType] = useState(null); // null | 'pickup' | 'empty_box'
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdMission, setCreatedMission] = useState(null);
  const [mapOpen, setMapOpen] = useState(false);

  /* ─── Link to empty box (pickup only) ─────────────────── */
  const [linkedEmptyBoxMission, setLinkedEmptyBoxMission] = useState(null);
  const [emptyBoxMissionPickerOpen, setEmptyBoxMissionPickerOpen] = useState(false);

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
  const [notes, setNotes] = useState('');
  /** When user has no india/thailand on profile (e.g. admin), pick region manually for empty_box and pickup. */
  const [manualShippingDestination, setManualShippingDestination] = useState('');

  const impliedShippingDestination = authCountryToShippingDestination(authCountry);
  /** india | thailand for LionWheel + server country (empty_box + pickup when user must pick region). */
  const effectiveLwRegion =
    impliedShippingDestination ||
    (manualShippingDestination === 'india' || manualShippingDestination === 'thailand' ? manualShippingDestination : null);

  /* ─── User autocomplete ──────────────────────────────── */
  const [allUsers, setAllUsers]           = useState([]);
  const [userSuggestions, setUserSuggestions] = useState([]);
  const [activeField, setActiveField]     = useState(null); // 'fullName' | 'israeliPhone'
  const suggestRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    fetch(`${API_BASE}/users`).then((r) => r.json()).then(setAllUsers).catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    if (missionType !== 'pickup') setAffiliatePickerOpen(false);
  }, [missionType]);

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
      if (name === 'israeliPhone') {
        const normalize = (p) => String(p || '').replace(/\D/g, '').replace(/^0+/, '');
        return normalize(u.phone).includes(normalize(q));
      }
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
    const fromProfile = authCountryToShippingDestination(u.country);
    setManualShippingDestination(fromProfile ?? '');
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
    if (step === 2) {
      if (missionType === 'empty_box') return !!mapAddress;
      return !!mapAddress;
    }
    if (step === 3) {
      if (missionType === 'pickup') {
        if (!impliedShippingDestination && !effectiveLwRegion) return false;
        // sub-step 1: entering pickup box count
        if (pickupBoxCount === null) {
          const raw = pickupBoxCountInput.trim();
          if (raw === '') return true;
          const v = parseInt(raw, 10);
          return !isNaN(v) && v >= 0;
        }
        // sub-step 2: yes/no — must click a button, cannot use Next
        if (bringBoxes === null) return false;
        if (bringBoxes === false) return true;
        return boxCounts.large + boxCounts.small > 0;
      }
      if (missionType === 'empty_box' && !effectiveLwRegion) return false;
      return boxCounts.large + boxCounts.small > 0;
    }
    return true;
  };

  const handleNext = () => {
    // step 3 pickup sub-step: confirm pickup box count, stay on step 3
    if (step === 3 && missionType === 'pickup' && pickupBoxCount === null) {
      const raw = pickupBoxCountInput.trim();
      setPickupBoxCount(raw === '' ? 0 : (parseInt(pickupBoxCountInput, 10) || 0));
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
    if ((missionType === 'empty_box' || missionType === 'pickup') && !effectiveLwRegion) {
      setError('Choose ship-to: India or Thailand');
      return;
    }
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
          linkedEmptyBoxMissionId: missionType === 'pickup' && linkedEmptyBoxMission ? linkedEmptyBoxMission.id : null,
          createdBy: 'customer_service',
          affiliateName: missionType === 'pickup' && viaAffiliate && selectedAffiliate ? selectedAffiliate.name : null,
          discountAmount: missionType === 'pickup' && viaAffiliate && selectedAffiliate ? selectedAffiliate.discountAmount : null,
          ...((missionType === 'pickup' || missionType === 'empty_box') && effectiveLwRegion
            ? { country: effectiveLwRegion }
            : {}),
          notes: notes.trim() || undefined,
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
          ...(effectiveLwRegion ? { country: effectiveLwRegion } : {}),
        }),
      }).catch(() => {});
      onCreated?.(mission);
      setCreatedMission(mission);
    } catch (e) {
      setError(e.message || 'Error saving mission');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setMissionType(null); setStep(1); setError('');
    setCreatedMission(null);
    setForm({ fullName: '', israeliPhone: '', senderCity: '', senderStreet: '', senderHouseNumber: '', senderApartment: '', senderFloor: '' });
    setMapAddress(null); setBoxCounts({ large: 0, small: 0 }); setBringBoxes(null);
    setPickupBoxCount(null); setPickupBoxCountInput('');
    setLinkedEmptyBoxMission(null);
    setViaAffiliate(false); setSelectedAffiliate(null);
    setNotes('');
    setManualShippingDestination('');
    onClose();
  };

  if (!isOpen) return null;

  if (submitting && !createdMission) {
    return (
      <>
        <div className="modal-overlay z-50 items-end sm:items-center p-0 sm:p-4">
          <div className="modal-content max-w-md max-h-[95vh] rounded-t-2xl sm:rounded-2xl flex flex-col items-center justify-center py-16 px-8">
            <Loader2 className="w-14 h-14 text-indigo-500 animate-spin mb-6 shrink-0" aria-hidden />
            <p className="text-lg font-semibold text-slate-800 text-center">Creating mission...</p>
            <p className="text-sm text-slate-500 mt-2 text-center max-w-xs">
              Saving your mission and syncing with LionWheel.
            </p>
          </div>
        </div>
      </>
    );
  }

  if (createdMission) {
    const lwOk = !!createdMission.lionwheel?.taskId;
    const lwErr = createdMission.lionwheel?.syncError;
    const notesForDriver = String(createdMission.notes || '').trim();
    return (
      <>
        <div className="modal-overlay z-50 items-end sm:items-center p-0 sm:p-4">
          <div className="modal-content max-w-3xl max-h-[95vh] rounded-t-2xl sm:rounded-2xl">
            <div className="modal-header flex-shrink-0">
              <h2 className="text-lg font-bold text-slate-800">Mission Created</h2>
              <button onClick={handleClose} className="action-btn hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="modal-body flex flex-col items-center gap-5 py-8">
              {/* Mission OK */}
              <div className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle className="w-9 h-9 text-emerald-500" />
                </div>
                <p className="font-bold text-slate-800 text-base">Mission saved</p>
                    <p className="font-mono text-sm text-indigo-600">{createdMission.id}</p>
              </div>

              {notesForDriver && (
                <>
                  <div className="w-full border-t border-slate-100" />
                  <div className="w-full max-w-md px-1 text-center">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Notes for driver (LionWheel)</p>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">{notesForDriver}</p>
                  </div>
                </>
              )}

              {/* Divider */}
              <div className="w-full border-t border-slate-100" />

              {/* LionWheel status */}
              <div className="flex flex-col items-center gap-2">
                {lwOk ? (
                  <>
                    <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
                      <CheckCircle className="w-7 h-7 text-indigo-500" />
                    </div>
                    <p className="font-semibold text-slate-700 text-sm">Synced to LionWheel</p>
                    <p className="font-mono text-xs text-indigo-600">Task ID: {createdMission.lionwheel.taskId}</p>
                    {createdMission.lionwheel.trackingLink && (
                      <a
                        href={createdMission.lionwheel.trackingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-indigo-500 hover:underline"
                      >
                        Open tracking
                      </a>
                    )}
                  </>
                ) : lwErr ? (
                  <>
                    <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                      <Package className="w-7 h-7 text-amber-500" />
                    </div>
                    <p className="font-semibold text-slate-700 text-sm">LionWheel sync failed</p>
                    <p className="text-xs text-red-500 text-center max-w-xs">{lwErr}</p>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                      <Package className="w-7 h-7 text-slate-400" />
                    </div>
                    <p className="text-sm text-slate-400">Not synced to LionWheel</p>
                  </>
                )}
              </div>
            </div>
            <div className="modal-footer flex-shrink-0">
              <button onClick={handleClose} className="btn-primary flex-1">Done</button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="modal-overlay z-50 items-end sm:items-center p-0 sm:p-4">
        <div className="modal-content max-w-3xl max-h-[95vh] rounded-t-2xl sm:rounded-2xl">

          {/* Header */}
          <div className="modal-header flex-shrink-0">
            <h2 className="text-lg font-bold text-slate-800">
              {missionType === 'pickup' ? 'Pickup Mission' : missionType === 'empty_box' ? 'Empty Box Mission' : 'Create New Mission'}
            </h2>
            <button onClick={handleClose} className="action-btn hover:bg-slate-100 text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="modal-body">

            {/* Type selection */}
            {!missionType && (
              <div>
                <p className="text-slate-500 text-sm mb-5">Select mission type:</p>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => { setMissionType('empty_box'); setViaAffiliate(false); setSelectedAffiliate(null); setManualShippingDestination(''); }}
                    className="p-6 rounded-2xl border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 flex flex-col items-center gap-3 transition-all duration-200 hover:shadow-md"
                  >
                    <Package className="w-10 h-10 text-indigo-500" />
                    <span className="font-semibold text-slate-800">Empty Box</span>
                    <span className="text-xs text-slate-500 text-center">Send empty boxes to customer address</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMissionType('pickup'); setManualShippingDestination(''); }}
                    className="p-6 rounded-2xl border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 flex flex-col items-center gap-3 transition-all duration-200 hover:shadow-md"
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
                <StepBar current={step} missionType={missionType} />

                {step === 1 && (
                  <div className="space-y-4" ref={suggestRef}>
                    {missionType === 'pickup' && (
                      <div className="card p-4 border-2 border-dashed border-indigo-200 bg-indigo-50/30 space-y-2">
                        <label className="label">Link to Empty Box Mission</label>
                        <p className="text-xs text-slate-500">Optional — link this pickup to an existing empty box delivery to auto-fill details</p>
                        <button
                          type="button"
                          onClick={() => setEmptyBoxMissionPickerOpen(true)}
                          className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all duration-200 text-left ${
                            linkedEmptyBoxMission
                              ? 'border-indigo-400 bg-indigo-100'
                              : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/50'
                          }`}
                        >
                          <Link2 className="w-5 h-5 text-indigo-600 shrink-0" />
                          {linkedEmptyBoxMission ? (
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate">{linkedEmptyBoxMission.fullName}</p>
                              <p className="text-xs text-slate-500 truncate">{linkedEmptyBoxMission.address?.displayAddress}</p>
                              <p className="text-xs font-mono text-indigo-600">{linkedEmptyBoxMission.id}</p>
                            </div>
                          ) : (
                            <span className="text-sm text-slate-500">Select empty box mission…</span>
                          )}
                          {linkedEmptyBoxMission && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setLinkedEmptyBoxMission(null); }}
                              className="text-xs text-red-500 hover:underline"
                            >
                              Remove
                            </button>
                          )}
                        </button>
                      </div>
                    )}

                    <h3 className="text-base font-bold text-slate-800 mb-1">Sender Details</h3>

                    {/* Phone with autocomplete */}
                    <Field label="Phone" required>
                      <div className="relative">
                        <PhoneInput
                          defaultCode="+972"
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
                    <h3 className="text-base font-bold text-slate-800 mb-1">Address</h3>
                    <AddressBlock
                      mapAddr={mapAddress}
                      form={form}
                      onMap={() => setMapOpen(true)}
                      onClear={() => { setMapAddress(null); setForm((p) => ({ ...p, senderCity: '', senderStreet: '', senderHouseNumber: '', senderApartment: '', senderFloor: '' })); }}
                      onFieldChange={handleChange}
                    />
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-4">
                    {(missionType === 'empty_box' || missionType === 'pickup') && !impliedShippingDestination && (
                      <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-2">
                        <h3 className="text-base font-bold text-slate-800">
                          {missionType === 'empty_box' ? 'Ship boxes to' : 'Ship to / LionWheel'}
                        </h3>
                        <p className="text-sm text-slate-600">
                          {missionType === 'empty_box'
                            ? 'Required — admin accounts have no default region; choose where boxes ship (same as LionWheel destination).'
                            : 'Required — choose India or Thailand for LionWheel routing and warehouse container.'}
                        </p>
                        <select
                          value={manualShippingDestination}
                          onChange={(e) => setManualShippingDestination(e.target.value)}
                          className="select-field w-full"
                          required
                        >
                          <option value="">India or Thailand…</option>
                          {SHIPPING_DESTINATIONS.map((d) => (
                            <option key={d.id} value={d.id}>{d.label}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {missionType === 'pickup' && pickupBoxCount === null ? (
                      <>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-slate-800 mb-1">Boxes to collect</h3>
                          <span className="badge-pill bg-slate-100 text-slate-500">optional</span>
                        </div>
                        <p className="text-sm text-slate-500 -mt-2">How many boxes are we picking up? Leave blank or 0 if not yet known.</p>
                        <input
                          type="number" min="0"
                          value={pickupBoxCountInput}
                          onChange={(e) => setPickupBoxCountInput(e.target.value)}
                          placeholder="0"
                          className="input-field !py-3 !text-lg font-bold text-slate-800 text-center"
                          autoFocus
                        />
                      </>
                    ) : null}
                    {missionType === 'pickup' && bringBoxes === null && pickupBoxCount !== null && (
                      <>
                        <h3 className="text-base font-bold text-slate-800 mb-1">Boxes</h3>
                        <p className="text-sm text-slate-500 -mt-2">Does the customer need empty boxes delivered?</p>
                        <div className="grid grid-cols-2 gap-3 mt-2">
                          <button
                            type="button"
                            onClick={() => setBringBoxes(true)}
                            className="p-5 rounded-2xl border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 flex flex-col items-center gap-2 transition-all duration-200 hover:shadow-md"
                          >
                            <Package className="w-8 h-8 text-indigo-500" />
                            <span className="font-semibold text-slate-800 text-sm">Yes</span>
                            <span className="text-xs text-slate-500 text-center">Bring empty boxes to customer</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => { setBringBoxes(false); setBoxCounts({ large: 0, small: 0 }); setStep(4); }}
                            className="p-5 rounded-2xl border-2 border-slate-200 hover:border-slate-400 hover:bg-slate-50 flex flex-col items-center gap-2 transition-all duration-200 hover:shadow-md"
                          >
                            <Truck className="w-8 h-8 text-slate-400" />
                            <span className="font-semibold text-slate-800 text-sm">No</span>
                            <span className="text-xs text-slate-500 text-center">Customer doesn't need additional boxes</span>
                          </button>
                        </div>
                      </>
                    )}
                    {(missionType === 'empty_box' || (missionType === 'pickup' && bringBoxes === true)) && (
                      <>
                        <div className="flex items-center justify-between">
                          <h3 className="text-base font-bold text-slate-800">Box Selection</h3>
                          {missionType === 'pickup' && (
                            <button type="button" onClick={() => { setBringBoxes(null); setBoxCounts({ large: 0, small: 0 }); }}
                              className="text-xs text-indigo-600 hover:underline font-medium">Change</button>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 -mt-2">Select at least one box to continue.</p>
                        <div className="space-y-3">
                          {BOX_TYPES.map((bt) => {
                            const count = boxCounts[bt.id];
                            const BtIcon = bt.icon;
                            return (
                              <div key={bt.id} className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 ${count > 0 ? 'border-indigo-400 bg-indigo-50/60 shadow-sm' : 'border-slate-200 bg-white'}`}>
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${count > 0 ? 'bg-indigo-100' : 'bg-slate-100'}`}>
                                  <BtIcon className={`w-6 h-6 ${count > 0 ? 'text-indigo-600' : 'text-slate-400'}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-slate-800 text-sm">{bt.label}</p>
                                  <p className="text-xs text-slate-500">{bt.sub}</p>
                                </div>
                                <div className="flex items-center gap-2.5 flex-shrink-0">
                                  <button type="button" onClick={() => setBoxCounts((p) => ({ ...p, [bt.id]: Math.max(0, p[bt.id] - 1) }))} disabled={count === 0}
                                    className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center disabled:opacity-30 hover:bg-indigo-700 transition-all duration-200 hover:shadow-md">
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <span className="w-7 text-center font-bold text-slate-800 text-base">{count}</span>
                                  <button type="button" onClick={() => setBoxCounts((p) => ({ ...p, [bt.id]: p[bt.id] + 1 }))}
                                    className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 transition-all duration-200 hover:shadow-md">
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {(boxCounts.large + boxCounts.small) > 0 && (
                          <p className="text-sm font-medium text-indigo-700 bg-indigo-50/80 px-4 py-2.5 rounded-xl border border-indigo-100">
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
                    <h3 className="text-base font-bold text-slate-800 mb-1">Mission Summary</h3>
                    <div className="card p-4 space-y-2">
                      <p className="label mb-2">Details</p>
                      <SummaryRow label="Name"  value={form.fullName} />
                      <SummaryRow label="Phone" value={form.israeliPhone} />
                      <SummaryRow label="Type"  value={missionType === 'pickup' ? 'Pickup Box' : 'Empty Box'} />
                      {effectiveLwRegion && (missionType === 'empty_box' || missionType === 'pickup') && (
                        <SummaryRow label="Ship to" value={shippingDestinationLabel(effectiveLwRegion)} />
                      )}
                    </div>
                    <div className="card p-4 space-y-2">
                      <p className="label mb-2">Address</p>
                      <SummaryRow label="Address" value={mapAddress?.displayAddress || [form.senderStreet, form.senderHouseNumber, form.senderCity].filter(Boolean).join(', ')} />
                      {form.senderApartment && <SummaryRow label="Apt"   value={form.senderApartment} />}
                      {form.senderFloor     && <SummaryRow label="Floor" value={form.senderFloor} />}
                    </div>
                    <div className="card p-4 space-y-2">
                      <p className="label mb-1">Notes for driver</p>
                      <p className="text-xs text-slate-500 mb-2">
                        Optional. Appended to LionWheel task notes and shown to the driver.
                      </p>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-300 resize-y min-h-[4.5rem]"
                        placeholder="Gate code, floor, timing, etc."
                      />
                    </div>
                    {(missionType !== 'pickup' || bringBoxes !== false) && (
                      <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 space-y-2">
                        <p className="label text-indigo-600 mb-2">Boxes</p>
                        {boxCounts.large > 0 && <SummaryRow label="ISA-BOX-70 (Large)" value={String(boxCounts.large)} />}
                        {boxCounts.small > 0 && <SummaryRow label="ISA-BOX-35 (Small)" value={String(boxCounts.small)} />}
                        <SummaryRow label="Total" value={String(boxCounts.large + boxCounts.small)} />
                      </div>
                    )}
                    {missionType === 'pickup' && linkedEmptyBoxMission && (
                      <div className="card p-4 space-y-2">
                        <p className="label mb-1">Linked to Empty Box</p>
                        <SummaryRow label="Mission" value={linkedEmptyBoxMission.id} />
                        <SummaryRow label="Customer" value={linkedEmptyBoxMission.fullName} />
                      </div>
                    )}
                    {missionType === 'pickup' && (
                      <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-100 space-y-2">
                        <p className="label text-amber-600 mb-1">Pickup from customer</p>
                        <SummaryRow label="Boxes to collect" value={String(pickupBoxCount ?? 0)} />
                      </div>
                    )}
                    {missionType === 'pickup' && bringBoxes === false && (
                      <div className="card p-4">
                        <p className="label mb-1">Empty boxes delivery</p>
                        <p className="text-sm text-slate-500">Customer doesn't need additional boxes</p>
                      </div>
                    )}

                    {missionType === 'pickup' && (
                    <>
                    {/* Affiliate — pickup missions only (discount & commission) */}
                    <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${viaAffiliate ? 'border-indigo-400 bg-indigo-50/60' : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30'}`}>
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
                      <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3.5">
                        {selectedAffiliate ? (
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-slate-800">{selectedAffiliate.name}</p>
                              <p className="text-xs text-slate-500">{selectedAffiliate.promoCode}{selectedAffiliate.discountAmount ? ` · ₪${selectedAffiliate.discountAmount} discount` : ''}</p>
                            </div>
                            <button type="button" onClick={() => setAffiliatePickerOpen(true)} className="text-xs text-indigo-600 hover:underline shrink-0 font-medium">Change</button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setAffiliatePickerOpen(true)}
                            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 rounded-xl transition-colors"
                          >
                            Select affiliate
                          </button>
                        )}
                      </div>
                    )}
                    </>
                    )}
                  </div>
                )}

                {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="modal-footer flex-shrink-0">
            <button
              type="button"
              onClick={handleBack}
              className="btn-secondary"
            >
              <ChevronLeft className="w-4 h-4" />
              {!missionType ? 'Cancel' : 'Back'}
            </button>
            {missionType && (step < totalSteps ? (
              <button
                type="button"
                disabled={!canProceed()}
                onClick={handleNext}
                className="btn-primary flex-1"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmit}
                className="btn-success flex-1"
              >
                <CheckCircle className="w-4 h-4" />
                Create Mission
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

      <EmptyBoxMissionPickerModal
        isOpen={emptyBoxMissionPickerOpen}
        onClose={() => setEmptyBoxMissionPickerOpen(false)}
        onSelect={(m) => {
          setLinkedEmptyBoxMission(m);
          setEmptyBoxMissionPickerOpen(false);
          if (m) {
            setForm((p) => ({
              ...p,
              fullName: m.fullName || p.fullName,
              israeliPhone: m.customerPhone || p.israeliPhone,
              senderCity: m.address?.city || p.senderCity,
              senderStreet: m.address?.street || p.senderStreet,
              senderHouseNumber: m.address?.houseNumber || p.senderHouseNumber,
              senderApartment: m.address?.apartment || p.senderApartment,
              senderFloor: m.address?.floor || p.senderFloor,
            }));
            if (m.address?.lat) setMapAddress(m.address);
            const reg = missionLwRegionId(m);
            setManualShippingDestination(reg ?? '');
          }
        }}
      />

      {missionType === 'pickup' && (
        <AffiliatePickerModal
          isOpen={affiliatePickerOpen}
          onClose={() => setAffiliatePickerOpen(false)}
          onSelect={(a) => { setSelectedAffiliate(a); setAffiliatePickerOpen(false); }}
        />
      )}
    </>
  );
}
