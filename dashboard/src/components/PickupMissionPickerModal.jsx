import { useState, useEffect, useMemo } from 'react';
import { X, Truck, Link2, Info, AlertTriangle, Unlink } from 'lucide-react';
import { API_BASE } from '../config';
import { LS_PICKUP_SEARCH, LS_PICKUP_LAST_CHOSEN_ID, notifyPickerPreferenceChanged } from '../pickerPreferences';
import { maxPickupLinksForEmptyBox } from '../pickerSlots';

function Row({ label, value }) {
  if (value == null || value === '') return null;
  return (
    <div className="flex gap-3 text-sm">
      <span className="w-28 shrink-0 text-slate-500">{label}</span>
      <span className="break-words text-left font-medium text-slate-800">{String(value)}</span>
    </div>
  );
}

export default function PickupMissionPickerModal({
  isOpen,
  onClose,
  onSelect,
  emptyBoxMissionId,
  onPreviewPickup,
  dataRefreshKey = 0,
  onLinksChanged,
}) {
  const [missions, setMissions] = useState([]);
  const [search, setSearch] = useState('');
  const [lastChosenId, setLastChosenId] = useState(null);
  const [emptyBoxMission, setEmptyBoxMission] = useState(null);
  const [linkedPickups, setLinkedPickups] = useState([]);
  const [linkedLoading, setLinkedLoading] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    try {
      setSearch(localStorage.getItem(LS_PICKUP_SEARCH) ?? '');
    } catch {
      setSearch('');
    }
    try {
      setLastChosenId(localStorage.getItem(LS_PICKUP_LAST_CHOSEN_ID));
    } catch {
      setLastChosenId(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !emptyBoxMissionId) {
      setEmptyBoxMission(null);
      setLinkedPickups([]);
      setMissions([]);
      return;
    }
    setLinkedLoading(true);
    Promise.all([
      fetch(`${API_BASE}/missions/${encodeURIComponent(emptyBoxMissionId)}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`${API_BASE}/missions?type=pickup&linkedEmptyBoxMissionId=${encodeURIComponent(emptyBoxMissionId)}`).then((r) =>
        r.ok ? r.json() : []
      ),
      fetch(`${API_BASE}/missions?type=pickup`).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([box, pickups, allPickups]) => {
        setEmptyBoxMission(box);
        setLinkedPickups(Array.isArray(pickups) ? pickups : []);
        setMissions(Array.isArray(allPickups) ? allPickups : []);
      })
      .catch(() => {
        setEmptyBoxMission(null);
        setLinkedPickups([]);
        setMissions([]);
      })
      .finally(() => setLinkedLoading(false));
  }, [isOpen, emptyBoxMissionId, dataRefreshKey]);

  const persistSearch = (value) => {
    setSearch(value);
    try {
      localStorage.setItem(LS_PICKUP_SEARCH, value);
    } catch {
      // ignore quota
    }
  };

  const maxLinks = emptyBoxMission ? maxPickupLinksForEmptyBox(emptyBoxMission) : 1;
  const slotsFull = !linkedLoading && linkedPickups.length >= maxLinks;
  const slotsLabel = linkedLoading
    ? '…'
    : `${linkedPickups.length} / ${maxLinks} slots`;

  const available = useMemo(() => {
    if (!isOpen || !emptyBoxMissionId) return [];
    const list = missions.filter((m) => m.linkedEmptyBoxMissionId !== emptyBoxMissionId);
    if (!lastChosenId) return list;
    const idx = list.findIndex((m) => m.id === lastChosenId);
    if (idx <= 0) return list;
    const next = [...list];
    const [picked] = next.splice(idx, 1);
    return [picked, ...next];
  }, [missions, emptyBoxMissionId, lastChosenId, isOpen]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return available.filter((m) => (
      (m.fullName || '').toLowerCase().includes(q) ||
      (m.id || '').toLowerCase().includes(q) ||
      (m.customerPhone || '').replace(/\D/g, '').includes(q.replace(/\D/g, '')) ||
      ((m.address && m.address.displayAddress) || '').toLowerCase().includes(q)
    ));
  }, [available, search]);

  const handleUnlink = async (pickupMission) => {
    if (!pickupMission?.id || unlinkingId) return;
    setUnlinkingId(pickupMission.id);
    try {
      const res = await fetch(`${API_BASE}/missions/${pickupMission.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkedEmptyBoxMissionId: null }),
      });
      if (res.ok) {
        onLinksChanged?.();
      } else {
        let msg = 'Could not remove link';
        try {
          const j = await res.json();
          if (j.error) msg = j.error;
        } catch {}
        window.alert(msg);
      }
    } catch {
      window.alert('Could not remove link');
    } finally {
      setUnlinkingId(null);
    }
  };

  if (!isOpen || !emptyBoxMissionId) return null;

  return (
    <div className="modal-overlay z-[70]">
      <div className="modal-content max-w-xl max-h-[90vh]">
        <div className="modal-header shrink-0">
          <h3 className="text-base font-bold text-slate-800 tracking-tight">Link pickup mission</h3>
          <button type="button" onClick={onClose} className="action-btn hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {/* Linked Pickup Missions — same style as mission preview */}
          <div className="card mx-5 mt-5 mb-3 shrink-0 border-stone-100/90 bg-gradient-to-b from-stone-50/50 to-white">
            <div className="flex items-center gap-2.5 border-b border-slate-100/90 bg-amber-50/35 px-5 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/90 shadow-sm ring-1 ring-amber-100">
                <Link2 className="h-4 w-4 shrink-0 text-indigo-600" />
              </div>
              <span className="text-sm font-semibold text-slate-800">Linked Pickup Missions</span>
            </div>
            <div className="space-y-3 p-5">
              {linkedLoading ? (
                <p className="text-sm text-slate-500">Loading…</p>
              ) : (
                <>
                  <span className="badge-pill border border-indigo-100/90 bg-indigo-50 text-indigo-800 shadow-sm">{slotsLabel}</span>
                  {slotsFull && (
                    <div className="flex items-start gap-3 rounded-xl border border-amber-200/90 bg-gradient-to-r from-amber-50 to-orange-50/60 px-4 py-3 text-sm text-amber-950 shadow-sm">
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                      <span>All slots are full — remove a link from a pickup mission or increase box counts on the empty box mission to add more.</span>
                    </div>
                  )}
                  <div className="space-y-3">
                    {linkedPickups.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-start justify-between gap-3 rounded-xl border border-slate-100/90 bg-white p-4 shadow-sm transition-all duration-200 hover:border-stone-200 hover:shadow-md"
                      >
                        <div className="min-w-0 flex-1 space-y-1.5 text-left">
                          <Row label="ID" value={p.id} />
                          <Row label="Customer" value={p.fullName} />
                          <Row label="Phone" value={p.customerPhone} />
                          <Row label="Boxes to collect" value={p.pickupBoxCount} />
                        </div>
                        <div className="flex shrink-0 items-center gap-1 self-center">
                          {onPreviewPickup && (
                            <button
                              type="button"
                              onClick={() => onPreviewPickup(p)}
                              className="action-btn text-indigo-600 hover:bg-indigo-50"
                              title="Preview"
                            >
                              <Info className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={unlinkingId === p.id}
                            onClick={() => handleUnlink(p)}
                            className="action-btn text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:hover:scale-100"
                            title="Remove link to this empty box"
                          >
                            <Unlink className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {linkedPickups.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-slate-200/90 bg-gradient-to-b from-slate-50/80 to-stone-50/40 px-6 py-10 text-center">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-white shadow-inner ring-1 ring-slate-100">
                          <Truck className="h-7 w-7 text-slate-400" />
                        </div>
                        <p className="text-sm font-medium italic text-slate-600">No pickups linked to this empty box yet</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className={`shrink-0 border-b border-slate-100/90 bg-gradient-to-b from-orange-50/25 to-stone-50/20 px-6 py-4 ${slotsFull ? 'pointer-events-none opacity-50' : ''}`}>
            <input
              disabled={slotsFull}
              className="input-field disabled:cursor-not-allowed disabled:bg-slate-100/80 disabled:opacity-90"
              placeholder="Search by name, phone, address, ID..."
              value={search}
              onChange={(e) => persistSearch(e.target.value)}
            />
          </div>

          <ul className="min-h-[120px] flex-1 space-y-2 overflow-y-auto p-3">
            {slotsFull ? (
              <li className="px-2 py-10">
                <div className="card mx-auto max-w-sm rounded-2xl border-amber-100/80 bg-gradient-to-b from-amber-50/60 to-stone-50/30 px-8 py-10 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-amber-100 ring-1 ring-amber-200/50">
                    <AlertTriangle className="h-7 w-7 text-amber-700" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">No more links allowed — slot limit reached.</p>
                </div>
              </li>
            ) : (
              <>
                {filtered.length === 0 && (
                  <li className="px-2 py-8">
                    <div className="card rounded-2xl border-stone-200/80 bg-gradient-to-b from-stone-50/70 via-white to-amber-50/20 px-8 py-10 text-center shadow-sm">
                      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-xl bg-orange-100/90 ring-1 ring-orange-200/40">
                        <Truck className="h-8 w-8 text-orange-700" />
                      </div>
                      <p className="text-base font-semibold text-slate-800">
                        {available.length === 0 ? 'All pickup missions are already linked to this empty box' : 'No matching pickup missions'}
                      </p>
                    </div>
                  </li>
                )}
                {filtered.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (slotsFull) return;
                        try {
                          localStorage.setItem(LS_PICKUP_LAST_CHOSEN_ID, m.id);
                        } catch {
                          // ignore
                        }
                        setLastChosenId(m.id);
                        notifyPickerPreferenceChanged();
                        onSelect(m);
                      }}
                      className="group flex w-full items-center gap-4 rounded-xl border border-transparent bg-white px-5 py-4 text-left transition-all duration-200 ease-out hover:border-orange-200/70 hover:bg-gradient-to-r hover:from-orange-50/90 hover:to-amber-50/50 hover:shadow-md active:scale-[0.99]"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 ring-1 ring-orange-200/40 transition-transform duration-200 group-hover:scale-105">
                        <Truck className="h-5 w-5 text-orange-700" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800">{m.fullName || '—'}</p>
                        <p className="truncate text-xs text-slate-500">{m.customerPhone || ''}</p>
                        <p className="truncate text-xs text-slate-600">{(m.address && m.address.displayAddress) || '—'}</p>
                        <p className="font-mono text-xs text-slate-400">{m.id}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
