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
import PackagePreviewModal from './PackagePreviewModal';
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

export default function PackagesPanel({ authCountry = null }) {
  const [missions, setMissions] = useState([]);
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filterContainer, setFilterContainer] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [previewPackage, setPreviewPackage] = useState(null);
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
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="stat-card border-l-4 border-indigo-500">
          <div className="text-3xl font-extrabold text-slate-800">{rows.length}</div>
          <div className="text-sm text-slate-500 mt-1">Total deliveries (pickup only)</div>
        </div>
        <div className="stat-card border-l-4 border-violet-500">
          <div className="text-3xl font-extrabold text-violet-600">{containers.length}</div>
          <div className="text-sm text-slate-500 mt-1">Containers</div>
        </div>
        <div className="stat-card border-l-4 border-amber-500">
          <div className="text-3xl font-extrabold text-amber-600">
            {missions.filter((m) => !m.containerId).length}
          </div>
          <div className="text-sm text-slate-500 mt-1">No container</div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="section-title">
            <Package className="w-5 h-5 text-indigo-500" />
            Packages ({rows.length})
          </h2>
          <button
            type="button"
            onClick={() => setCreatePackageOpen(true)}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" />
            Create Package
          </button>
        </div>
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/30 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, phone or ID..."
              className="input-field pl-10"
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
              className="select-field"
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
          <div className="px-6 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between gap-4 flex-wrap">
            <span className="font-semibold text-indigo-800">
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
                className="select-field min-w-[160px]"
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
                className="btn-secondary !py-1.5"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading...</div>
        ) : error ? (
          <div className="p-12 text-center text-red-600">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <Package className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-base font-medium text-slate-500">No packages to display</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-center">
              <thead>
                <tr className="table-header">
                  <th className="w-10">
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
                  <th>Package ID</th>
                  <th>Tracking</th>
                  <th>Delivery</th>
                  <th>Status</th>
                  <th>Sender</th>
                  <th>Receiver</th>
                  <th>Delivery Address</th>
                  <th>Container</th>
                  <th className="w-12">Summary</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ mission, delivery, deliveryIdx, packageId }) => (
                  <tr
                    key={packageId}
                    className={`table-row ${
                      selectedIds.has(packageId) ? 'row-selected' : ''
                    }`}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(packageId)}
                        onChange={() => toggleSelect(packageId)}
                        className="w-4 h-4 accent-indigo-600 cursor-pointer rounded"
                      />
                    </td>
                    <td><span className="table-id">{packageId}</span></td>
                    <td className="max-w-[10rem]">
                      <p className="text-sm font-mono text-slate-600 truncate" title={(delivery.boxTrackingIds ?? []).filter(Boolean).join(', ')}>
                        {(delivery.boxTrackingIds ?? []).filter(Boolean).length > 0
                          ? (delivery.boxTrackingIds ?? []).filter(Boolean).join(', ')
                          : '—'}
                      </p>
                    </td>
                    <td>
                      <span className="badge-pill bg-orange-100 text-orange-700">
                        <Truck className="w-3.5 h-3.5 shrink-0" />
                        Pickup
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge-pill ${
                          STATUS_COLORS[mission.status] || 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {STATUS_LABELS[mission.status] || mission.status}
                      </span>
                    </td>
                    <td className="max-w-[10rem]">
                      <p className="text-sm font-medium text-slate-700 truncate">
                        {mission.fullName || '—'}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {mission.customerPhone || ''}
                      </p>
                    </td>
                    <td className="max-w-[10rem]">
                      <p className="text-sm font-medium text-slate-700 truncate">
                        {delivery.receiverName || '—'}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {delivery.receiverPhone || ''}
                      </p>
                    </td>
                    <td className="max-w-[12rem]">
                      {delivery.address?.lat ? (
                        <span className="inline-flex items-center gap-1 text-sm text-slate-600 truncate">
                          <MapPin className="w-3.5 h-3.5 text-green-500 shrink-0" />
                          {delivery.address?.displayAddress || '—'}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-sm">—</span>
                      )}
                    </td>
                    <td>
                      <select
                        value={mission.containerId || ''}
                        onChange={(e) =>
                          handleContainerChange(mission.id, e.target.value || null)
                        }
                        disabled={updatingId === mission.id}
                        className="select-field !py-1.5 min-w-[140px]"
                      >
                        <option value="">No container</option>
                        {containers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name || c.id}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => setPreviewPackage({ mission, delivery, packageId })}
                        className="action-btn hover:bg-indigo-50 text-slate-400 hover:text-indigo-600"
                        title="View package summary"
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

      {previewPackage && (
        <PackagePreviewModal
          packageData={previewPackage}
          onClose={() => setPreviewPackage(null)}
        />
      )}

      <CreatePackageModal
        isOpen={createPackageOpen}
        onClose={() => setCreatePackageOpen(false)}
        onCreated={() => { setCreatePackageOpen(false); fetchData(); }}
        authCountry={authCountry}
      />
    </div>
  );
}
