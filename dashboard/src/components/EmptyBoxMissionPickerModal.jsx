import { useState, useEffect } from 'react';
import { X, Package } from 'lucide-react';
import { API_BASE } from '../config';

export default function EmptyBoxMissionPickerModal({ isOpen, onClose, onSelect }) {
  const [missions, setMissions] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    fetch(`${API_BASE}/missions?type=empty_box`).then((r) => r.json()).then(setMissions).catch(() => {});
    setSearch('');
  }, [isOpen]);

  if (!isOpen) return null;
  const filtered = missions.filter((m) => {
    const q = search.toLowerCase();
    return (
      (m.fullName || '').toLowerCase().includes(q) ||
      (m.customerPhone || '').replace(/\D/g, '').includes(q.replace(/\D/g, '')) ||
      ((m.address && m.address.displayAddress) || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[70vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-bold text-slate-800">Link to Empty Box Mission</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-4 py-3 border-b">
          <input
            autoFocus
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            placeholder="Search by name, phone, address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <ul className="flex-1 overflow-y-auto divide-y divide-slate-100">
          <li>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onSelect(null); }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left transition-colors"
            >
              <span className="text-sm text-slate-500 italic">No link — standalone pickup</span>
            </button>
          </li>
          {filtered.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-400">No empty box missions found</li>}
          {filtered.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onSelect(m); }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 text-left transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-yellow-100 flex items-center justify-center shrink-0">
                  <Package className="w-4 h-4 text-yellow-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{m.fullName || '—'}</p>
                  <p className="text-xs text-slate-400 truncate">{m.customerPhone || ''}</p>
                  <p className="text-xs text-slate-500 truncate">{(m.address && m.address.displayAddress) || '—'}</p>
                  <p className="text-xs font-mono text-slate-400">{m.id}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
