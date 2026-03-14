import { useState, useEffect, useRef, useCallback } from 'react';
import { X, MapPin, User, CheckCircle, ChevronRight, ChevronLeft, Package, Plus, Trash2, Pencil } from 'lucide-react';
import AddressPicker from './AddressPicker';
import PhoneInput from './PhoneInput';
import { geocodeAddress } from '../utils/geocode';
import { API_BASE } from '../config';

const PACKAGE_STEPS = [
  { id: 1, label: 'Sender', icon: User },
  { id: 2, label: 'Receiver & Delivery', icon: MapPin },
  { id: 3, label: 'Boxes & Contents', icon: Package },
  { id: 4, label: 'Summary', icon: CheckCircle },
];

function StepBar({ current }) {
  return (
    <div className="flex items-center gap-0 mb-6">
      {PACKAGE_STEPS.map((s, i) => {
        const done = current > s.id;
        const active = current === s.id;
        const Icon = s.icon;
        return (
          <div key={s.id} className="flex flex-1 min-w-0">
            <div className="flex flex-col items-center gap-1 flex-shrink-0 w-full">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                done ? 'bg-indigo-600 border-indigo-600 text-white' :
                active ? 'bg-white border-indigo-600 text-indigo-600' :
                'bg-white border-slate-200 text-slate-400'
              }`}>
                {done ? <CheckCircle className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>
              <span className={`text-[10px] font-medium whitespace-nowrap ${
                active ? 'text-indigo-700' : done ? 'text-indigo-400' : 'text-slate-400'
              }`}>{s.label}</span>
            </div>
            {i < PACKAGE_STEPS.length - 1 && (
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
              <p className="text-xs text-slate-400 truncate">{u.phone}</p>
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
      <span className="text-slate-500 w-28 flex-shrink-0">{label}</span>
      <span className="text-slate-800 font-medium">{value}</span>
    </div>
  );
}

export default function CreatePackageModal({ isOpen, onClose, onCreated }) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [deliveryMapOpen, setDeliveryMapOpen] = useState(false);
  const suggestRef = useRef(null);

  const [form, setForm] = useState({
    fullName: '',
    israeliPhone: '',
    receiverName: '',
    receiverPhone: '',
    receiverCity: '',
    receiverStreet: '',
    receiverHouseNumber: '',
    receiverApartment: '',
    receiverFloor: '',
  });
  const [deliveryMapAddress, setDeliveryMapAddress] = useState(null);
  const [boxCount, setBoxCount] = useState(1);
  const [boxWeights, setBoxWeights] = useState(['']);
  const [boxTrackingIds, setBoxTrackingIds] = useState(['']);
  const [boxContents, setBoxContents] = useState([[]]);
  const [userSuggestions, setUserSuggestions] = useState([]);
  const [activeField, setActiveField] = useState(null);
  const [receiverSuggestions, setReceiverSuggestions] = useState([]);
  const [activeReceiverField, setActiveReceiverField] = useState(null);
  const [parcelContentTypes, setParcelContentTypes] = useState([]);

  useEffect(() => {
    if (isOpen) {
      fetch(`${API_BASE}/parcel-content-types`).then((r) => r.ok ? r.json() : []).then(setParcelContentTypes).catch(() => []);
    }
  }, [isOpen]);

  useEffect(() => {
    const handler = (e) => {
      if (suggestRef.current && !suggestRef.current.contains(e.target)) {
        setUserSuggestions([]);
        setActiveField(null);
        setReceiverSuggestions([]);
        setActiveReceiverField(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filterSuggestions = (field, value) => {
    if (!value || value.length < 2) { setUserSuggestions([]); return; }
    const digits = (value || '').replace(/\D/g, '');
    const isPhoneLookup = field === 'israeliPhone' && digits.length >= 7;
    if (isPhoneLookup) {
      fetch(`${API_BASE}/customers/by-phone?phone=${encodeURIComponent(value)}`)
        .then((r) => r.ok ? r.json() : null)
        .then((user) => {
          if (user) {
            setUserSuggestions([user]);
          } else {
            setUserSuggestions([]);
          }
        })
        .catch(() => setUserSuggestions([]));
    } else {
      fetch(`${API_BASE}/users?q=${encodeURIComponent(value)}`)
        .then((r) => r.ok ? r.json() : [])
        .then((users) => {
          const q = (value || '').toLowerCase();
          const matches = users.filter((u) =>
            (u.fullName || '').toLowerCase().includes(q) ||
            (u.phone || '').replace(/\D/g, '').includes(q.replace(/\D/g, ''))
          );
          setUserSuggestions(matches.slice(0, 6));
        })
        .catch(() => setUserSuggestions([]));
    }
  };

  const applySuggestion = (u) => {
    setForm((p) => ({ ...p, fullName: u.fullName || p.fullName, israeliPhone: u.phone || p.israeliPhone }));
    setUserSuggestions([]);
    setActiveField(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    setActiveField(name);
    if (name === 'fullName' || name === 'israeliPhone') filterSuggestions(name, value);
  };

  const filterReceiverSuggestions = (field, value) => {
    if (!value || value.length < 2) { setReceiverSuggestions([]); return; }
    const digits = (value || '').replace(/\D/g, '');
    const isPhoneLookup = field === 'receiverPhone' && digits.length >= 7;
    if (isPhoneLookup) {
      fetch(`${API_BASE}/receivers/by-phone?phone=${encodeURIComponent(value)}`)
        .then((r) => r.ok ? r.json() : null)
        .then((rcv) => setReceiverSuggestions(rcv ? [rcv] : []))
        .catch(() => setReceiverSuggestions([]));
    } else {
      fetch(`${API_BASE}/receivers?q=${encodeURIComponent(value)}`)
        .then((r) => r.ok ? r.json() : [])
        .then((receivers) => {
          const q = (value || '').toLowerCase();
          const matches = receivers.filter((r) =>
            (r.fullName || '').toLowerCase().includes(q) ||
            (r.phone || '').replace(/\D/g, '').includes(q.replace(/\D/g, ''))
          );
          setReceiverSuggestions(matches.slice(0, 6));
        })
        .catch(() => setReceiverSuggestions([]));
    }
  };

  const applyReceiverSuggestion = (r) => {
    setForm((p) => ({
      ...p,
      receiverPhone: r.phone || p.receiverPhone,
      receiverName: r.fullName || p.receiverName,
      receiverCity: r.address?.city ?? p.receiverCity,
      receiverStreet: r.address?.street ?? p.receiverStreet,
      receiverHouseNumber: r.address?.houseNumber ?? p.receiverHouseNumber,
    }));
    if (r.address?.lat != null) setDeliveryMapAddress(r.address);
    setReceiverSuggestions([]);
    setActiveReceiverField(null);
  };

  const canProceed = () => {
    if (step === 1) return form.fullName.trim() && form.israeliPhone.trim();
    if (step === 2) return form.receiverName.trim() && form.receiverPhone.trim() && !!deliveryMapAddress;
    if (step === 3) return boxCount >= 1;
    return true;
  };

  const handleSubmit = async () => {
    setSubmitting(true); setError('');
    try {
      const deliveryCoords = deliveryMapAddress?.lat != null
        ? { lat: deliveryMapAddress.lat, lng: deliveryMapAddress.lng }
        : await geocodeAddress({ city: form.receiverCity, street: form.receiverStreet, houseNumber: form.receiverHouseNumber });
      const deliveryAddr = {
        displayAddress: deliveryMapAddress?.displayAddress || [form.receiverStreet, form.receiverHouseNumber, form.receiverCity].filter(Boolean).join(', '),
        lat: deliveryCoords?.lat,
        lng: deliveryCoords?.lng,
        city: form.receiverCity,
        street: form.receiverStreet,
        houseNumber: form.receiverHouseNumber,
        apartment: form.receiverApartment,
        floor: form.receiverFloor,
      };

      const packageId = `PKG-${Date.now()}`;
      const weights = boxWeights.slice(0, boxCount).map((w) => parseFloat(w) || 0);
      const trackingIds = boxTrackingIds.slice(0, boxCount).map(String);
      const contents = boxContents.slice(0, boxCount).map((arr) =>
        Array.isArray(arr) ? arr.map((it) => ({ description: it.description || '', qty: it.qty ?? 1, price: it.price ?? 0 })) : []
      );

      const delivery = {
        id: packageId,
        receiverName: form.receiverName.trim(),
        receiverPhone: form.receiverPhone.trim(),
        address: deliveryAddr,
        boxCount,
        boxWeights: weights,
        boxTrackingIds: trackingIds,
        boxContents: contents,
      };

      const res = await fetch(`${API_BASE}/missions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'pickup',
          status: 'linewhel_transferred',
          createdBy: 'customer_service',
          fullName: form.fullName.trim(),
          customerPhone: form.israeliPhone.trim(),
          address: null,
          senderAddress: null,
          pickupBoxCount: boxCount,
          pickupBoxWeights: weights.length > 0 ? weights : null,
          deliveries: [delivery],
          receiverName: form.receiverName.trim(),
          receiverPhone: form.receiverPhone.trim(),
          receiverAddress: deliveryAddr,
        }),
      });
      if (!res.ok) throw new Error('Save error');
      const mission = await res.json();

      fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          phone: form.israeliPhone.trim(),
          address: null,
        }),
      }).catch(() => {});

      if ((form.receiverPhone || '').replace(/\D/g, '').length >= 7) {
        fetch(`${API_BASE}/receivers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName: form.receiverName.trim(),
            phone: form.receiverPhone.trim(),
            address: deliveryAddr,
          }),
        }).catch(() => {});
      }

      onCreated?.(mission);
      handleClose();
    } catch (e) {
      setError(e.message || 'Error saving package');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep(1); setError('');
    setForm({
      fullName: '', israeliPhone: '',
      receiverName: '', receiverPhone: '',
      receiverCity: '', receiverStreet: '', receiverHouseNumber: '', receiverApartment: '', receiverFloor: '',
    });
    setDeliveryMapAddress(null);
    setBoxCount(1);
    setBoxWeights(['']);
    setBoxTrackingIds(['']);
    setBoxContents([[]]);
    setUserSuggestions([]);
    onClose();
  };

  const updateBoxCount = (n) => {
    const count = Math.max(1, n);
    setBoxCount(count);
    setBoxWeights((prev) => Array.from({ length: count }, (_, i) => prev[i] ?? ''));
    setBoxTrackingIds((prev) => Array.from({ length: count }, (_, i) => prev[i] ?? ''));
    setBoxContents((prev) => Array.from({ length: count }, (_, i) => prev[i] ?? []));
  };

  const addContentItem = (boxIdx) => {
    setBoxContents((prev) => {
      const next = [...prev];
      if (!next[boxIdx]) next[boxIdx] = [];
      next[boxIdx] = [...next[boxIdx], { description: '', qty: 1, price: 0 }];
      return next;
    });
  };

  const removeContentItem = (boxIdx, itemIdx) => {
    setBoxContents((prev) => {
      const next = [...prev];
      if (next[boxIdx]) next[boxIdx] = next[boxIdx].filter((_, i) => i !== itemIdx);
      return next;
    });
  };

  const updateContentItem = (boxIdx, itemIdx, field, value) => {
    setBoxContents((prev) => {
      const next = [...prev];
      if (!next[boxIdx]) next[boxIdx] = [];
      next[boxIdx] = next[boxIdx].map((it, i) =>
        i === itemIdx ? { ...it, [field]: value } : it
      );
      return next;
    });
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
        <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[95vh]">
          <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0">
            <h2 className="text-lg font-bold text-slate-800">Create New Package</h2>
            <button onClick={handleClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            <StepBar current={step} />

            {step === 1 && (
              <div className="space-y-4" ref={suggestRef}>
                <h3 className="font-semibold text-slate-800 text-base mb-1">Sender Details</h3>
                <Field label="Phone" required>
                  <div className="relative">
                    <PhoneInput
                      value={form.israeliPhone}
                      onChange={(v) => { setForm((p) => ({ ...p, israeliPhone: v })); setActiveField('israeliPhone'); filterSuggestions('israeliPhone', v); }}
                      onFocus={() => { setActiveField('israeliPhone'); filterSuggestions('israeliPhone', form.israeliPhone); }}
                      placeholder="501234567"
                    />
                    {activeField === 'israeliPhone' && userSuggestions.length > 0 && (
                      <SuggestionDropdown suggestions={userSuggestions} onSelect={applySuggestion} />
                    )}
                  </div>
                </Field>
                <Field label="Full name" required>
                  <div className="relative">
                    <input
                      className={inputCls}
                      name="fullName"
                      value={form.fullName}
                      onChange={handleChange}
                      onFocus={() => { setActiveField('fullName'); filterSuggestions('fullName', form.fullName); }}
                      placeholder="Full name"
                    />
                    {activeField === 'fullName' && userSuggestions.length > 0 && (
                      <SuggestionDropdown suggestions={userSuggestions} onSelect={applySuggestion} />
                    )}
                  </div>
                </Field>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4" ref={suggestRef}>
                <h3 className="font-semibold text-slate-800 text-base mb-1">Receiver & Delivery Address</h3>
                <Field label="Receiver phone" required>
                  <div className="relative">
                    <PhoneInput
                      value={form.receiverPhone}
                      onChange={(v) => {
                        setForm((p) => ({ ...p, receiverPhone: v }));
                        setActiveReceiverField('receiverPhone');
                        filterReceiverSuggestions('receiverPhone', v);
                      }}
                      onFocus={() => {
                        setActiveReceiverField('receiverPhone');
                        filterReceiverSuggestions('receiverPhone', form.receiverPhone);
                      }}
                      placeholder="501234567"
                    />
                    {activeReceiverField === 'receiverPhone' && receiverSuggestions.length > 0 && (
                      <SuggestionDropdown suggestions={receiverSuggestions} onSelect={applyReceiverSuggestion} />
                    )}
                  </div>
                </Field>
                <Field label="Receiver name" required>
                  <div className="relative">
                    <input
                      className={inputCls}
                      name="receiverName"
                      value={form.receiverName}
                      onChange={(e) => {
                        handleChange(e);
                        setActiveReceiverField('receiverName');
                        filterReceiverSuggestions('receiverName', e.target.value);
                      }}
                      onFocus={() => {
                        setActiveReceiverField('receiverName');
                        filterReceiverSuggestions('receiverName', form.receiverName);
                      }}
                      placeholder="Full name"
                    />
                    {activeReceiverField === 'receiverName' && receiverSuggestions.length > 0 && (
                      <SuggestionDropdown suggestions={receiverSuggestions} onSelect={applyReceiverSuggestion} />
                    )}
                  </div>
                </Field>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Delivery address</label>
                  <button
                    type="button"
                    onClick={() => setDeliveryMapOpen(true)}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 border-2 rounded-xl text-sm transition-colors ${
                      deliveryMapAddress ? 'border-green-300 bg-green-50 text-green-700 hover:border-green-400' : 'border-dashed border-slate-300 text-slate-600 hover:border-indigo-400'
                    }`}
                  >
                    <MapPin className="w-4 h-4 shrink-0" />
                    <span className="truncate flex-1 text-left">{deliveryMapAddress?.displayAddress || 'Pick location on map…'}</span>
                    {deliveryMapAddress?.lat && <Pencil className="w-4 h-4 shrink-0 text-green-600" title="Edit address" />}
                  </button>
                  <AddressPicker
                    isOpen={deliveryMapOpen}
                    onClose={() => setDeliveryMapOpen(false)}
                    onSelect={(a) => { setDeliveryMapAddress(a); setDeliveryMapOpen(false); setForm((p) => ({ ...p, receiverCity: a.city || '', receiverStreet: a.street || '', receiverHouseNumber: a.houseNumber || '' })); }}
                    initialPosition={deliveryMapAddress?.lat ? [deliveryMapAddress.lat, deliveryMapAddress.lng] : undefined}
                  />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-800 text-base mb-1">Boxes & Contents</h3>
                <Field label="Number of boxes" required>
                  <input
                    type="number"
                    min="1"
                    value={boxCount}
                    onChange={(e) => updateBoxCount(parseInt(e.target.value) || 1)}
                    className={inputCls}
                  />
                </Field>
                {Array.from({ length: boxCount }, (_, i) => (
                  <div key={i} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                    <span className="text-xs font-semibold text-slate-500">Box {i + 1}</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={boxWeights[i] ?? ''}
                          onChange={(e) => {
                            const next = [...boxWeights];
                            next[i] = e.target.value;
                            setBoxWeights(next);
                          }}
                          placeholder="Weight (kg)"
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          value={boxTrackingIds[i] ?? ''}
                          onChange={(e) => {
                            const next = [...boxTrackingIds];
                            next[i] = e.target.value;
                            setBoxTrackingIds(next);
                          }}
                          placeholder="Tracking ID"
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
                        />
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-200">
                      <span className="text-[10px] text-slate-500 font-medium block mb-1.5">Parcel content</span>
                      {((boxContents[i]) || []).map((item, j) => (
                        <div key={j} className="flex flex-wrap gap-2 mb-1.5">
                          <select
                            value={item.description || ''}
                            onChange={(e) => updateContentItem(i, j, 'description', e.target.value)}
                            className="flex-1 min-w-[100px] px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
                          >
                            <option value="">Select type</option>
                            {parcelContentTypes.map((t) => (
                              <option key={t.id} value={t.label}>{t.label}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min="1"
                            value={item.qty ?? ''}
                            onChange={(e) => updateContentItem(i, j, 'qty', parseInt(e.target.value) || 0)}
                            placeholder="qty"
                            className="w-14 px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
                          />
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.price ?? ''}
                            onChange={(e) => updateContentItem(i, j, 'price', parseFloat(e.target.value) || 0)}
                            placeholder="₪"
                            className="w-16 px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
                          />
                          <button type="button" onClick={() => removeContentItem(i, j)} className="p-1 text-red-400 hover:text-red-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      <button type="button" onClick={() => addContentItem(i)} className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Add item
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-800 text-base mb-1">Summary</h3>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Sender</p>
                  <SummaryRow label="Name" value={form.fullName} />
                  <SummaryRow label="Phone" value={form.israeliPhone} />
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Receiver</p>
                  <SummaryRow label="Name" value={form.receiverName} />
                  <SummaryRow label="Phone" value={form.receiverPhone} />
                  <SummaryRow label="Address" value={deliveryMapAddress?.displayAddress} />
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Package</p>
                  <SummaryRow label="Boxes" value={boxCount} />
                </div>
              </div>
            )}

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
            )}
          </div>

          <div className="flex items-center justify-between gap-4 px-5 py-4 border-t flex-shrink-0">
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 1}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            {step < 4 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                disabled={!canProceed()}
                className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !canProceed()}
                className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? 'Saving…' : 'Create Package'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
