import { useState, useEffect } from 'react';
import { X, Plus, Trash2, MapPin, CheckCircle, Truck, Package, AlertTriangle, Copy, Link2 } from 'lucide-react';
import AddressPicker from './AddressPicker';
import PhoneInput from './PhoneInput';
import EmptyBoxMissionPickerModal from './EmptyBoxMissionPickerModal';
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
        {row.address?.lat != null && (
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-xs font-medium text-slate-500">Coords:</span>
            <code className="text-xs font-mono bg-slate-100 px-2 py-1 rounded">
              {typeof row.address.lat === 'number' ? row.address.lat.toFixed(6) : row.address.lat},{' '}
              {typeof row.address.lng === 'number' ? row.address.lng.toFixed(6) : row.address.lng}
            </code>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(`${row.address.lat}, ${row.address.lng}`)}
              className="p-1 hover:bg-slate-200 rounded"
              title="Copy coordinates"
            >
              <Copy className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </div>
        )}
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
            const prevWeights = row.boxWeights ?? [];
            const prevIds = row.boxTrackingIds ?? [];
            const boxWeights = Array.from({ length: val }, (_, i) => (prevWeights[i] !== undefined && prevWeights[i] !== '') ? prevWeights[i] : '');
            const boxTrackingIds = Array.from({ length: val }, (_, i) => (prevIds[i] !== undefined && prevIds[i] !== '') ? prevIds[i] : '');
            onChange({ ...row, boxCount: val, boxWeights, boxTrackingIds });
          }}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
      </div>
      {(row.boxCount ?? 0) > 0 && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Weight & Tracking ID per box</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Array.from({ length: row.boxCount }, (_, i) => (
                <div key={i} className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2">
                  <label className="block text-[10px] text-slate-500 font-medium">Box {i + 1}</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <input
                        type="number" min="0" step="0.1"
                        value={(row.boxWeights ?? [])[i] ?? ''}
                        onChange={(e) => {
                          const next = [...(row.boxWeights ?? [])];
                          next[i] = e.target.value;
                          onChange({ ...row, boxWeights: next });
                        }}
                        placeholder="kg"
                        className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      />
                      <span className="text-[10px] text-slate-400">Weight</span>
                    </div>
                    <div>
                      <input
                        type="text"
                        value={(row.boxTrackingIds ?? [])[i] ?? ''}
                        onChange={(e) => {
                          const next = [...(row.boxTrackingIds ?? [])];
                          next[i] = e.target.value;
                          onChange({ ...row, boxTrackingIds: next });
                        }}
                        placeholder="Tracking ID"
                        className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      />
                      <span className="text-[10px] text-slate-400">Tracking ID</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
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
    if (mission.deliveries?.length) {
      return mission.deliveries.map((d) => {
        const count = d.boxCount ?? 0;
        const boxWeights = d.boxWeights && Array.isArray(d.boxWeights)
          ? d.boxWeights.map(String)
          : Array.from({ length: count }, () => '');
        const boxTrackingIds = d.boxTrackingIds && Array.isArray(d.boxTrackingIds)
          ? d.boxTrackingIds.map(String)
          : Array.from({ length: count }, () => '');
        return { ...d, boxWeights, boxTrackingIds };
      });
    }
    const w = mission.pickupBoxWeights;
    const initialWeights = Array.isArray(w) && w.length === initialBoxCount ? w.map(String) : Array.from({ length: initialBoxCount }, () => '');
    const initialTrackingIds = Array.from({ length: initialBoxCount }, () => '');
    return [{
      id: `d-${Date.now()}`,
      receiverName:  mission.receiverName  || '',
      receiverPhone: mission.receiverPhone || '',
      address:       mission.receiverAddress || null,
      boxCount:      initialBoxCount,
      boxWeights:    initialWeights,
      boxTrackingIds: initialTrackingIds,
    }];
  });

  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [linkedEmptyBoxMissionId, setLinkedEmptyBoxMissionId] = useState(mission.linkedEmptyBoxMissionId ?? null);
  const [linkedEmptyBoxMission, setLinkedEmptyBoxMission] = useState(null);
  const [emptyBoxMissionPickerOpen, setEmptyBoxMissionPickerOpen] = useState(false);

  useEffect(() => {
    if (linkedEmptyBoxMissionId) {
      fetch(`${API_BASE}/missions/${linkedEmptyBoxMissionId}`)
        .then((r) => r.ok ? r.json() : null)
        .then(setLinkedEmptyBoxMission)
        .catch(() => setLinkedEmptyBoxMission(null));
    } else {
      setLinkedEmptyBoxMission(null);
    }
  }, [linkedEmptyBoxMissionId]);

  useEffect(() => {
    if (isOpen) {
      setLinkedEmptyBoxMissionId(mission.linkedEmptyBoxMissionId ?? null);
    }
  }, [isOpen, mission.linkedEmptyBoxMissionId]);

  if (!isOpen) return null;

  const totalAssigned = deliveries.reduce((s, d) => s + (d.boxCount || 0), 0);
  const remaining     = pickupBoxCount - totalAssigned;
  const overLimit     = totalAssigned > pickupBoxCount;
  const allSet        = totalAssigned === pickupBoxCount;

  const handlePickupBoxCountChange = (val) => {
    const n = Math.max(1, val);
    setPickupBoxCount(n);
    if (deliveries.length === 1) {
      const prev = deliveries[0];
      const boxWeights = Array.from({ length: n }, (_, i) => (prev.boxWeights?.[i] !== undefined && prev.boxWeights[i] !== '') ? prev.boxWeights[i] : '');
      const boxTrackingIds = Array.from({ length: n }, (_, i) => (prev.boxTrackingIds?.[i] !== undefined && prev.boxTrackingIds[i] !== '') ? prev.boxTrackingIds[i] : '');
      setDeliveries([{ ...prev, boxCount: n, boxWeights, boxTrackingIds }]);
    }
  };

  const updateRow = (idx, newRow) =>
    setDeliveries((prev) => prev.map((d, i) => (i === idx ? newRow : d)));

  const addRow = () => {
    if (remaining <= 0) return;
    setDeliveries((prev) => [
      ...prev,
      { id: `d-${Date.now()}`, receiverName: '', receiverPhone: '', address: null, boxCount: remaining, boxWeights: Array.from({ length: remaining }, () => ''), boxTrackingIds: Array.from({ length: remaining }, () => '') },
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
          pickupBoxWeights: pickupBoxCount > 0 ? deliveries.flatMap((d) => (d.boxWeights ?? []).map((w) => parseFloat(w) || 0)) : null,
          bringBoxes,
          boxSelection: bringBoxes ? boxSelection : { large: 0, small: 0 },
          deliveries,
          linkedEmptyBoxMissionId,
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

          {/* Link to empty box */}
          <div className="p-4 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/30 space-y-2">
            <label className="block text-sm font-medium text-slate-700">Link to Empty Box Mission</label>
            <p className="text-xs text-slate-500">Associate this pickup with the empty box delivery</p>
            <button
              type="button"
              onClick={() => setEmptyBoxMissionPickerOpen(true)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                linkedEmptyBoxMission || linkedEmptyBoxMissionId
                  ? 'border-indigo-400 bg-indigo-100'
                  : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/50'
              }`}
            >
              <Link2 className="w-5 h-5 text-indigo-600 shrink-0" />
              {linkedEmptyBoxMission ? (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{linkedEmptyBoxMission.fullName}</p>
                  <p className="text-xs text-slate-500 truncate">{linkedEmptyBoxMission.address && linkedEmptyBoxMission.address.displayAddress}</p>
                  <p className="text-xs font-mono text-indigo-600">{linkedEmptyBoxMission.id}</p>
                </div>
              ) : linkedEmptyBoxMissionId ? (
                <span className="text-sm text-slate-600 font-mono">{linkedEmptyBoxMissionId}</span>
              ) : (
                <span className="text-sm text-slate-500">Select empty box mission…</span>
              )}
              {(linkedEmptyBoxMission || linkedEmptyBoxMissionId) && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setLinkedEmptyBoxMissionId(null); setLinkedEmptyBoxMission(null); }}
                  className="text-xs text-red-500 hover:underline"
                >
                  Remove
                </button>
              )}
            </button>
          </div>

          {/* Pickup info */}
          <div className="space-y-4">
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

        <EmptyBoxMissionPickerModal
          isOpen={emptyBoxMissionPickerOpen}
          onClose={() => setEmptyBoxMissionPickerOpen(false)}
          onSelect={(m) => {
            setLinkedEmptyBoxMissionId(m?.id || null);
            setEmptyBoxMissionPickerOpen(false);
          }}
        />

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
