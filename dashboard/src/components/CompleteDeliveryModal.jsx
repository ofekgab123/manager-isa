import { useState } from 'react';
import { X, Plus, Trash2, MapPin, CheckCircle, Truck, Package, AlertTriangle } from 'lucide-react';
import AddressPicker from './AddressPicker';
import PhoneInput from './PhoneInput';
import { API_BASE } from '../config';

/* ─── Single delivery row ────────────────────────────────────── */
function DeliveryRow({ row, idx, totalPickup, otherAssigned, onChange, onDelete, canDelete }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const maxForRow = totalPickup - otherAssigned;

  return (
    <div className="p-4 rounded-xl border-2 border-slate-200 bg-white space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
          Delivery address {idx + 1}
        </span>
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Receiver name</label>
          <input
            value={row.receiverName}
            onChange={(e) => onChange({ ...row, receiverName: e.target.value })}
            placeholder="Full name"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Receiver phone</label>
          <PhoneInput
            value={row.receiverPhone}
            onChange={(v) => onChange({ ...row, receiverPhone: v })}
            placeholder="501234567"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Delivery address</label>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className={`w-full flex items-center gap-2 px-3 py-2.5 border-2 border-dashed rounded-lg text-sm transition-colors ${
            row.address?.lat
              ? 'border-green-300 bg-green-50 text-green-700 hover:border-green-400'
              : 'border-slate-300 text-slate-500 hover:border-indigo-400 hover:bg-indigo-50'
          }`}
        >
          <MapPin className="w-4 h-4 shrink-0" />
          <span className="truncate">{row.address?.displayAddress || 'Pick location on map…'}</span>
        </button>
        <AddressPicker
          isOpen={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={(a) => { onChange({ ...row, address: a }); setPickerOpen(false); }}
          initialPosition={row.address?.lat ? [row.address.lat, row.address.lng] : undefined}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">
          Boxes for this address
          <span className="text-slate-400 font-normal ml-1">(max {maxForRow})</span>
        </label>
        <input
          type="number"
          min="1"
          max={maxForRow}
          value={row.boxCount}
          onChange={(e) => {
            const val = Math.min(maxForRow, Math.max(1, parseInt(e.target.value) || 1));
            onChange({ ...row, boxCount: val });
          }}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
      </div>
    </div>
  );
}

/* ─── Main modal ─────────────────────────────────────────────── */
export default function CompleteDeliveryModal({ isOpen, mission, onClose, onSaved }) {
  const initialBoxCount =
    mission.pickupBoxCount ||
    (mission.boxSelection?.large || 0) + (mission.boxSelection?.small || 0) ||
    1;

  const [pickupBoxCount, setPickupBoxCount] = useState(initialBoxCount);
  const [bringBoxes, setBringBoxes] = useState(mission.bringBoxes === true);
  const [boxSelection, setBoxSelection] = useState(
    mission.boxSelection ?? { large: 0, small: 0 }
  );
  const [deliveries, setDeliveries] = useState(() => {
    if (mission.deliveries?.length) return mission.deliveries;
    return [{
      id: `d-${Date.now()}`,
      receiverName:  mission.receiverName  || '',
      receiverPhone: mission.receiverPhone || '',
      address:       mission.receiverAddress || null,
      boxCount:      initialBoxCount,
    }];
  });

  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  if (!isOpen) return null;

  const totalAssigned = deliveries.reduce((s, d) => s + (d.boxCount || 0), 0);
  const remaining     = pickupBoxCount - totalAssigned;
  const overLimit     = totalAssigned > pickupBoxCount;
  const allSet        = totalAssigned === pickupBoxCount;

  const handlePickupBoxCountChange = (val) => {
    const n = Math.max(1, val);
    setPickupBoxCount(n);
    if (deliveries.length === 1) {
      setDeliveries([{ ...deliveries[0], boxCount: n }]);
    }
  };

  const updateRow = (idx, newRow) =>
    setDeliveries((prev) => prev.map((d, i) => (i === idx ? newRow : d)));

  const addRow = () => {
    if (remaining <= 0) return;
    setDeliveries((prev) => [
      ...prev,
      { id: `d-${Date.now()}`, receiverName: '', receiverPhone: '', address: null, boxCount: remaining },
    ]);
  };

  const removeRow = (idx) =>
    setDeliveries((prev) => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const res = await fetch(`${API_BASE}/missions/${mission.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickupBoxCount,
          bringBoxes,
          boxSelection: bringBoxes ? boxSelection : { large: 0, small: 0 },
          deliveries,
          // keep first delivery as the primary receiver for backwards compat
          receiverName:    deliveries[0]?.receiverName  || '',
          receiverPhone:   deliveries[0]?.receiverPhone || '',
          receiverAddress: deliveries[0]?.address       || null,
        }),
      });
      if (!res.ok) throw new Error('Save error');
      onSaved?.(await res.json());
      onClose();
    } catch (e) {
      setError(e.message || 'Error saving');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Truck className="w-5 h-5 text-indigo-600" />
            Complete Delivery Details
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {/* Pickup info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Boxes to collect from customer
              </label>
              <input
                type="number"
                min="1"
                value={pickupBoxCount}
                onChange={(e) => handlePickupBoxCountChange(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Bring empty boxes to customer?
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setBringBoxes(true)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                    bringBoxes
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'border-slate-200 text-slate-500 hover:border-indigo-300'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" /> Yes
                </button>
                <button
                  type="button"
                  onClick={() => setBringBoxes(false)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                    !bringBoxes
                      ? 'bg-slate-600 border-slate-600 text-white'
                      : 'border-slate-200 text-slate-500 hover:border-slate-400'
                  }`}
                >
                  <Truck className="w-3.5 h-3.5" /> No
                </button>
              </div>
            </div>
          </div>

          {/* Box types — only when bringing boxes */}
          {bringBoxes && (
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 space-y-3">
              <h4 className="font-semibold text-blue-800 text-sm">Box types to bring</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">ISA-BOX-70 (Large)</label>
                  <input
                    type="number" min="0"
                    value={boxSelection.large ?? ''}
                    onChange={(e) => setBoxSelection((p) => ({ ...p, large: parseInt(e.target.value) || 0 }))}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">ISA-BOX-35 (Small)</label>
                  <input
                    type="number" min="0"
                    value={boxSelection.small ?? ''}
                    onChange={(e) => setBoxSelection((p) => ({ ...p, small: parseInt(e.target.value) || 0 }))}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
              </div>
              {(boxSelection.large + boxSelection.small > 0) && (
                <p className="text-xs text-blue-600 font-medium">
                  Total: {boxSelection.large + boxSelection.small} boxes
                  {boxSelection.large > 0 && ` · ${boxSelection.large} Large`}
                  {boxSelection.small > 0 && ` · ${boxSelection.small} Small`}
                </p>
              )}
            </div>
          )}

          {/* Box assignment counter */}
          <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-medium border ${
            overLimit
              ? 'bg-red-50 text-red-700 border-red-200'
              : allSet
                ? 'bg-green-50 text-green-700 border-green-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}>
            <span>Boxes assigned: <strong>{totalAssigned}</strong> / <strong>{pickupBoxCount}</strong></span>
            {overLimit  && <span className="flex items-center gap-1 text-xs"><AlertTriangle className="w-3.5 h-3.5" /> Exceeds total</span>}
            {allSet     && <CheckCircle className="w-4 h-4" />}
            {!overLimit && !allSet && <span className="text-xs">{remaining} remaining</span>}
          </div>

          {/* Delivery rows */}
          <div className="space-y-3">
            {deliveries.map((row, idx) => {
              const otherAssigned = deliveries.reduce((s, d, i) => (i !== idx ? s + (d.boxCount || 0) : s), 0);
              return (
                <DeliveryRow
                  key={row.id}
                  row={row}
                  idx={idx}
                  totalPickup={pickupBoxCount}
                  otherAssigned={otherAssigned}
                  onChange={(r) => updateRow(idx, r)}
                  onDelete={() => removeRow(idx)}
                  canDelete={deliveries.length > 1}
                />
              );
            })}
          </div>

          {/* Add address */}
          {remaining > 0 && (
            <button
              type="button"
              onClick={addRow}
              className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-indigo-300 text-indigo-600 rounded-xl hover:bg-indigo-50 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Add delivery address
              <span className="text-xs text-indigo-400">({remaining} box{remaining !== 1 ? 'es' : ''} remaining)</span>
            </button>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t flex-shrink-0 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || overLimit}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save delivery details'}
          </button>
        </div>

      </div>
    </div>
  );
}
