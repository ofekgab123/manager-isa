import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Package,
  Search,
  Box,
  Truck,
  MapPin,
  X,
  Info,
  Plus,
} from 'lucide-react';
import { API_BASE } from '../config';
import MissionPreviewModal from './MissionPreviewModal';
import CreatePackageModal from './CreatePackageModal';

const TYPE_LABELS = {
  pickup: 'Pickup',
  empty_box: 'Empty Box',
};

const STATUS_LABELS = {
  received: 'Received',
  linewhel_transferred: 'Transferred',
  linewhel_scheduled: 'Scheduled',
  collected: 'Collected',
  shipped: 'Shipped',
  completed: 'Completed',
};

const STATUS_COLORS = {
  received: 'bg-blue-100 text-blue-700',
  linewhel_transferred: 'bg-amber-100 text-amber-700',
  linewhel_scheduled: 'bg-purple-100 text-purple-700',
  collected: 'bg-cyan-100 text-cyan-700',
  shipped: 'bg-indigo-100 text-indigo-700',
  completed: 'bg-green-100 text-green-700',
};

export default function PackagesPanel() {
  const [missions, setMissions] = useState([]);
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filterContainer, setFilterContainer] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [previewMission, setPreviewMission] = useState(null);
  const [createPackageOpen, setCreatePackageOpen] = useState(false);
  const selectAllRef = useRef(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [missionsRes, containersRes] = await Promise.all([
        fetch(`${API_BASE}/missions`),
        fetch(`${API_BASE}/containers`),
      ]);
      if (!missionsRes.ok) throw new Error('Failed to fetch missions');
      if (!containersRes.ok) throw new Error('Failed to fetch containers');
      const [missionsData, containersData] = await Promise.all([
        missionsRes.json(),
        containersRes.json(),
      ]);
      setMissions(missionsData.filter((m) => m.type === 'pickup'));
      setContainers(containersData);
    } catch (e) {
      setError(e.message);
      setMissions([]);
      setContainers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleContainerChange = async (missionId, containerId) => {
    setUpdatingId(missionId);
    try {
      const res = await fetch(`${API_BASE}/missions/${missionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ containerId: containerId || null }),
      });
      if (!res.ok) throw new Error('Failed to update');
      const updated = await res.json();
      setMissions((prev) =>
        prev.map((m) => (m.id === missionId ? updated : m))
      );
    } catch {
      // silent fail - could add toast
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const allFilteredPackageIds = new Set(filtered.map(({ packageId }) => packageId));
    if (selectedIds.size === allFilteredPackageIds.size) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(allFilteredPackageIds);
    }
  };

  // Flatten missions into one row per delivery - each package is independent with its own ID
  // PKG-{missionId}-{0/1/2} when from mission, PKG-{Date.now()} when standalone
  const rows = missions.flatMap((m) => {
    const deliveries = m.deliveries?.length > 0
      ? m.deliveries
      : [{
          receiverName: m.receiverName || '',
          receiverPhone: m.receiverPhone || '',
          address: m.receiverAddress || null,
          boxCount: m.pickupBoxCount ?? 1,
        }];
    return deliveries.map((d, idx) => {
      const missionNum = m?.id?.replace(/^MSN-/, '') ?? '';
      const packageId = (d.id && /^PKG-\d+$/.test(d.id)) ? d.id : (missionNum ? `PKG-${missionNum}-${idx}` : `PKG-${Date.now()}`);
      return { mission: m, delivery: d, deliveryIdx: idx, packageId };
    });
  });

  const filtered = rows.filter(({ mission: m, delivery: d, packageId }) => {
    if (filterContainer === 'none') {
      if (m.containerId) return false;
    } else if (filterContainer && m.containerId !== filterContainer) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        (m.fullName || '').toLowerCase().includes(q) ||
        (m.id || '').toLowerCase().includes(q) ||
        (m.customerPhone || '').replace(/\D/g, '').includes(q.replace(/\D/g, '')) ||
        (packageId || '').toLowerCase().includes(q) ||
        (d.receiverName || '').toLowerCase().includes(q) ||
        (d.receiverPhone || '').replace(/\D/g, '').includes(q.replace(/\D/g, '')) ||
        (d.boxTrackingIds ?? []).some((tid) => (tid || '').toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleBulkContainerAssign = async (containerId) => {
    const packageIds = Array.from(selectedIds);
    if (packageIds.length === 0) return;
    const missionIds = [...new Set(
      rows.filter((r) => packageIds.includes(r.packageId)).map((r) => r.mission.id)
    )];
    setBulkUpdating(true);
    try {
      await Promise.all(
        missionIds.map((id) =>
          fetch(`${API_BASE}/missions/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ containerId: containerId || null }),
          })
        )
      );
      const results = await Promise.all(
        missionIds.map((id) => fetch(`${API_BASE}/missions/${id}`).then((r) => r.json()))
      );
      setMissions((prev) =>
        prev.map((m) => {
          const updated = results.find((r) => r.id === m.id);
          return updated || m;
        })
      );
      setSelectedIds(new Set());
    } catch {
      // silent
    } finally {
      setBulkUpdating(false);
    }
  };

  const filteredPackageIds = new Set(filtered.map(({ packageId }) => packageId));

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        selectedIds.size > 0 && selectedIds.size < filteredPackageIds.size;
    }
  }, [selectedIds.size, filteredPackageIds.size]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="text-2xl font-bold text-slate-800">{rows.length}</div>
          <div className="text-sm text-slate-500">Total deliveries (pickup only)</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="text-2xl font-bold text-indigo-600">{containers.length}</div>
          <div className="text-sm text-slate-500">Containers</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="text-2xl font-bold text-amber-600">
            {missions.filter((m) => !m.containerId).length}
          </div>
          <div className="text-sm text-slate-500">No container</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Package className="w-5 h-5" />
            Packages ({rows.length})
          </h2>
          <button
            type="button"
            onClick={() => setCreatePackageOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Package
          </button>
        </div>
        <div className="px-4 py-3 border-b flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, phone or ID..."
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="min-w-[180px]">
            <select
              value={filterContainer}
              onChange={(e) => setFilterContainer(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="">All containers</option>
              <option value="none">No container</option>
              {containers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || c.id}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between gap-4 flex-wrap">
            <span className="font-medium text-indigo-800">
              {selectedIds.size} package{selectedIds.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-indigo-600">Assign to container:</span>
              <select
                value=""
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') return;
                  handleBulkContainerAssign(val === '__none__' ? null : val);
                }}
                disabled={bulkUpdating}
                className="px-3 py-2 border border-indigo-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-300 min-w-[160px]"
              >
                <option value="">Select container...</option>
                <option value="__none__">No container</option>
                {containers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.id}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-600">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>No packages to display</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-center">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={filteredPackageIds.size > 0 && selectedIds.size === filteredPackageIds.size}
                      ref={(el) => {
                        if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < filteredPackageIds.size;
                      }}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 accent-indigo-600 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3">Package ID</th>
                  <th className="px-4 py-3">Tracking</th>
                  <th className="px-4 py-3">Delivery</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Sender</th>
                  <th className="px-4 py-3">Receiver</th>
                  <th className="px-4 py-3">Delivery Address</th>
                  <th className="px-4 py-3">Container</th>
                  <th className="px-4 py-3 w-12">Summary</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ mission, delivery, deliveryIdx, packageId }) => (
                  <tr
                    key={packageId}
                    className={`border-b border-slate-100 hover:bg-slate-50/50 ${
                      selectedIds.has(packageId) ? 'bg-indigo-50/50' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(packageId)}
                        onChange={() => toggleSelect(packageId)}
                        className="w-4 h-4 accent-indigo-600 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-blue-600 text-sm">
                      {packageId}
                    </td>
                    <td className="px-4 py-3 max-w-[10rem]">
                      <p className="text-sm font-mono text-slate-600 truncate" title={(delivery.boxTrackingIds ?? []).filter(Boolean).join(', ')}>
                        {(delivery.boxTrackingIds ?? []).filter(Boolean).length > 0
                          ? (delivery.boxTrackingIds ?? []).filter(Boolean).join(', ')
                          : '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-sm font-medium px-2.5 py-1 rounded-full whitespace-nowrap bg-orange-100 text-orange-700">
                        <Truck className="w-3.5 h-3.5 shrink-0" />
                        Pickup
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-sm font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${
                          STATUS_COLORS[mission.status] || 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {STATUS_LABELS[mission.status] || mission.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[10rem]">
                      <p className="text-sm font-medium text-slate-700 truncate">
                        {mission.fullName || '—'}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {mission.customerPhone || ''}
                      </p>
                    </td>
                    <td className="px-4 py-3 max-w-[10rem]">
                      <p className="text-sm font-medium text-slate-700 truncate">
                        {delivery.receiverName || '—'}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {delivery.receiverPhone || ''}
                      </p>
                    </td>
                    <td className="px-4 py-3 max-w-[12rem]">
                      {delivery.address?.lat ? (
                        <span className="inline-flex items-center gap-1 text-sm text-slate-600 truncate">
                          <MapPin className="w-3.5 h-3.5 text-green-500 shrink-0" />
                          {delivery.address?.displayAddress || '—'}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={mission.containerId || ''}
                        onChange={(e) =>
                          handleContainerChange(mission.id, e.target.value || null)
                        }
                        disabled={updatingId === mission.id}
                        className="text-sm px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 min-w-[140px]"
                      >
                        <option value="">No container</option>
                        {containers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name || c.id}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setPreviewMission(mission)}
                        className="p-2 hover:bg-indigo-50 rounded-lg text-slate-500 hover:text-indigo-600 transition-colors"
                        title="View summary"
                      >
                        <Info className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {previewMission && (
        <MissionPreviewModal
          mission={previewMission}
          onClose={() => setPreviewMission(null)}
        />
      )}

      <CreatePackageModal
        isOpen={createPackageOpen}
        onClose={() => setCreatePackageOpen(false)}
        onCreated={() => { setCreatePackageOpen(false); fetchData(); }}
      />
    </div>
  );
}
