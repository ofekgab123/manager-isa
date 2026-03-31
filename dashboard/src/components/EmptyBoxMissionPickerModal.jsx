import { useState, useEffect, useMemo } from 'react';
import { X, Package } from 'lucide-react';
import { API_BASE } from '../config';
import { LS_EMPTYBOX_SEARCH, LS_EMPTYBOX_LAST_CHOSEN_ID, notifyPickerPreferenceChanged } from '../pickerPreferences';

export default function EmptyBoxMissionPickerModal({ isOpen, onClose, onSelect }) {
  const [missions, setMissions] = useState([]);
  const [search, setSearch] = useState('');
  const [lastChosenId, setLastChosenId] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    fetch(`${API_BASE}/missions?type=empty_box`).then((r) => r.json()).then(setMissions).catch(() => {});
    try {
      setSearch(localStorage.getItem(LS_EMPTYBOX_SEARCH) ?? '');
    } catch {
      setSearch('');
    }
    try {
      setLastChosenId(localStorage.getItem(LS_EMPTYBOX_LAST_CHOSEN_ID));
    } catch {
      setLastChosenId(null);
    }
  }, [isOpen]);

  const persistSearch = (value) => {
    setSearch(value);
    try {
      localStorage.setItem(LS_EMPTYBOX_SEARCH, value);
    } catch {
      // ignore
    }
  };

  const orderedMissions = useMemo(() => {
    if (!isOpen) return [];
    if (!lastChosenId) return missions;
    const idx = missions.findIndex((m) => m.id === lastChosenId);
    if (idx <= 0) return missions;
    const next = [...missions];
    const [picked] = next.splice(idx, 1);
    return [picked, ...next];
  }, [missions, lastChosenId, isOpen]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return orderedMissions.filter((m) => (
      (m.fullName || '').toLowerCase().includes(q) ||
      (m.customerPhone || '').replace(/\D/g, '').includes(q.replace(/\D/g, '')) ||
      ((m.address && m.address.displayAddress) || '').toLowerCase().includes(q)
    ));
  }, [orderedMissions, search]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay z-[70]">
      <div className="modal-content max-w-xl max-h-[80vh]">
        <div className="modal-header">
          <h3 className="text-base font-bold text-slate-800 tracking-tight">Link to Empty Box Mission</h3>
          <button onClick={onClose} className="action-btn hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-4 border-b border-slate-100/90 bg-gradient-to-b from-amber-50/40 to-stone-50/30">
          <input
            autoFocus
            className="input-field"
            placeholder="Search by name, phone, address..."
            value={search}
            onChange={(e) => persistSearch(e.target.value)}
          />
        </div>
        <ul className="flex-1 overflow-y-auto min-h-0 p-3 space-y-2">
          <li>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                try {
                  localStorage.removeItem(LS_EMPTYBOX_LAST_CHOSEN_ID);
                } catch {
                  // ignore
                }
                setLastChosenId(null);
                notifyPickerPreferenceChanged();
                onSelect(null);
              }}
              className="w-full flex items-center gap-4 px-5 py-4 rounded-xl border border-slate-100/80 bg-white/80 hover:border-stone-200 hover:bg-stone-50/90 hover:shadow-sm text-left transition-all duration-200 ease-out"
            >
              <span className="text-sm text-slate-500 italic">No link — standalone pickup</span>
            </button>
          </li>
          {filtered.length === 0 && (
            <li className="px-2 py-6">
              <div className="card rounded-2xl border border-amber-100/80 bg-gradient-to-b from-amber-50/50 via-white to-stone-50/40 px-8 py-10 text-center shadow-sm">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-xl bg-amber-100/90 shadow-inner ring-1 ring-amber-200/50">
                  <Package className="h-8 w-8 text-amber-700" />
                </div>
                <p className="text-base font-semibold text-slate-800">No empty box missions found</p>
              </div>
            </li>
          )}
          {filtered.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  try {
                    localStorage.setItem(LS_EMPTYBOX_LAST_CHOSEN_ID, m.id);
                  } catch {
                    // ignore
                  }
                  setLastChosenId(m.id);
                  notifyPickerPreferenceChanged();
                  onSelect(m);
                }}
                className="group w-full flex items-center gap-4 px-5 py-4 rounded-xl border border-transparent bg-white hover:border-amber-200/70 hover:bg-gradient-to-r hover:from-amber-50/80 hover:to-orange-50/40 hover:shadow-md text-left transition-all duration-200 ease-out active:scale-[0.99]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 ring-1 ring-amber-200/40 transition-transform duration-200 group-hover:scale-105">
                  <Package className="h-5 w-5 text-amber-700" />
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
        </ul>
      </div>
    </div>
  );
}
