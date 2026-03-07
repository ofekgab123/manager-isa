import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Package,
  Truck,
  TrendingUp,
  RefreshCw,
  Filter,
  ChevronDown,
  ChevronUp,
  Plus,
  Pencil,
  Trash2,
  X,
  AlertTriangle,
  Users,
  MapPin,
  Tag,
} from 'lucide-react';
import CreateMissionModal from './components/CreateMissionModal';
import MissionDetails from './components/MissionDetails';
import CompleteDeliveryModal from './components/CompleteDeliveryModal';
import AffiliatesPanel from './components/AffiliatesPanel';
import UsersPanel from './components/UsersPanel';
import { API_BASE } from './config';

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

const CREATED_BY_LABELS = {
  customer: 'Customer',
  customer_service: 'CS',
};

function ColLabel({ label, colKey, vis, toggle }) {
  return (
    <label className="flex items-center gap-1.5 text-xs font-medium mb-1 cursor-pointer select-none group">
      <input
        type="checkbox"
        checked={vis[colKey]}
        onChange={() => toggle(colKey)}
        className="w-3 h-3 accent-indigo-600 cursor-pointer"
      />
      <span className={vis[colKey] ? 'text-slate-600' : 'text-slate-400 line-through'}>{label}</span>
    </label>
  );
}

function useMissions(onNewMissions) {
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const knownIdsRef = useRef(new Set());

  const fetchMissions = async (isPoll = false) => {
    if (!isPoll) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/missions`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      if (isPoll && onNewMissions && knownIdsRef.current.size > 0) {
        const newOnes = data.filter((m) => !knownIdsRef.current.has(m.id));
        if (newOnes.length > 0) onNewMissions(newOnes);
      }
      knownIdsRef.current = new Set(data.map((m) => m.id));
      setMissions(data);
    } catch (e) {
      setError(e.message);
      setMissions([]);
    } finally {
      if (!isPoll) setLoading(false);
    }
  };

  useEffect(() => {
    fetchMissions();
    const interval = setInterval(() => fetchMissions(true), 5000);
    return () => clearInterval(interval);
  }, []);

  return { missions, loading, error, refetch: () => fetchMissions(false) };
}

function useMissionStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = () => {
    fetch(`${API_BASE}/missions/stats`)
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return { stats, loading, refetch: fetchStats };
}

const isMissingAddress = (m) => m.type === 'pickup' ? !m.receiverAddress?.lat : !m.address?.lat;

function useAffiliates() {
  const [affiliates, setAffiliates] = useState([]);
  const fetchAffiliates = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/affiliates`);
      if (res.ok) setAffiliates(await res.json());
    } catch {}
  }, []);
  useEffect(() => { fetchAffiliates(); }, [fetchAffiliates]);
  return affiliates;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('missions');
  const [newMissionAlert, setNewMissionAlert] = useState(null);
  const affiliates = useAffiliates();

  const handleNewMissions = (newOnes) => {
    const fromCustomer = newOnes.filter((m) => m.createdBy === 'customer');
    if (fromCustomer.length > 0) {
      setNewMissionAlert({ count: fromCustomer.length });
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('New mission!', {
          body: `${fromCustomer.length} new missions from customers`,
          icon: '/favicon.ico',
        });
      }
    }
  };

  const { missions, loading, error, refetch } = useMissions(handleNewMissions);
  const { stats, loading: statsLoading, refetch: refetchStats } = useMissionStats();

  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCreatedBy, setFilterCreatedBy] = useState('');
  const [filterMissingAddress, setFilterMissingAddress] = useState('');
  const [filterName, setFilterName] = useState('');
  const [filterPhone, setFilterPhone] = useState('');
  const [filterReceiverName, setFilterReceiverName] = useState('');
  const [filterReceiverPhone, setFilterReceiverPhone] = useState('');
  const [filterPickupAddr, setFilterPickupAddr] = useState('');
  const [filterDeliveryAddr, setFilterDeliveryAddr] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterBoxType, setFilterBoxType] = useState('');
  const [filterAffiliate, setFilterAffiliate] = useState('');

  const [visibleColumns, setVisibleColumns] = useState({
    type: true, status: true, sender: true, pickupAddr: true,
    receiver: true, deliveryAddr: true, boxes: true, source: true, date: true, affiliate: true,
    senderPhone: true, receiverPhone: true, missingInfo: true,
  });
  const [sectionVisible, setSectionVisible] = useState({ sender: true, receiver: true });
  const toggleSection = (key) => {
    setSectionVisible((p) => {
      const newVal = !p[key];
      if (key === 'sender') {
        setVisibleColumns((vc) => ({ ...vc, sender: newVal, senderPhone: newVal, pickupAddr: newVal }));
      } else if (key === 'receiver') {
        setVisibleColumns((vc) => ({ ...vc, receiver: newVal, receiverPhone: newVal, deliveryAddr: newVal, missingInfo: newVal }));
      }
      return { ...p, [key]: newVal };
    });
  };
  const toggleColumn = (key) => setVisibleColumns((p) => ({ ...p, [key]: !p[key] }));

  const [showFilters, setShowFilters] = useState(false);
  const [editingMission, setEditingMission] = useState(null);
  const [completingMission, setCompletingMission] = useState(null);
  const [showCreateMission, setShowCreateMission] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const activeFilterCount = [filterType, filterStatus, filterCreatedBy, filterMissingAddress, filterName, filterPhone, filterReceiverName, filterReceiverPhone, filterPickupAddr, filterDeliveryAddr, filterDateFrom, filterBoxType, filterAffiliate].filter(Boolean).length;

  const filtered = missions.filter((m) => {
    if (filterType && m.type !== filterType) return false;
    if (filterStatus && m.status !== filterStatus) return false;
    if (filterCreatedBy && m.createdBy !== filterCreatedBy) return false;
    if (filterMissingAddress === 'yes' && !isMissingAddress(m)) return false;
    if (filterMissingAddress === 'no' && isMissingAddress(m)) return false;
    if (filterName && !(m.fullName || '').toLowerCase().includes(filterName.toLowerCase())) return false;
    if (filterPhone && !(m.customerPhone || '').replace(/\D/g, '').includes(filterPhone.replace(/\D/g, ''))) return false;
    if (filterReceiverName && !(m.receiverName || '').toLowerCase().includes(filterReceiverName.toLowerCase())) return false;
    if (filterReceiverPhone && !(m.receiverPhone || '').replace(/\D/g, '').includes(filterReceiverPhone.replace(/\D/g, ''))) return false;
    if (filterPickupAddr && !(m.address?.displayAddress || '').toLowerCase().includes(filterPickupAddr.toLowerCase())) return false;
    if (filterDeliveryAddr && !(m.receiverAddress?.displayAddress || '').toLowerCase().includes(filterDeliveryAddr.toLowerCase())) return false;
    if (filterDateFrom && m.createdAt && new Date(m.createdAt) < new Date(filterDateFrom)) return false;
    if (filterBoxType === 'large' && !(m.boxSelection?.large > 0)) return false;
    if (filterBoxType === 'small' && !(m.boxSelection?.small > 0)) return false;
    if (filterAffiliate && m.affiliateName !== filterAffiliate) return false;
    return true;
  });

  const clearFilters = () => {
    setFilterType(''); setFilterStatus(''); setFilterCreatedBy(''); setFilterMissingAddress('');
    setFilterName(''); setFilterPhone(''); setFilterReceiverName(''); setFilterReceiverPhone('');
    setFilterPickupAddr(''); setFilterDeliveryAddr('');
    setFilterDateFrom(''); setFilterBoxType(''); setFilterAffiliate('');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this mission?')) return;
    setDeletingId(id);
    try {
      await fetch(`${API_BASE}/missions/${id}`, { method: 'DELETE' });
      refetch();
      refetchStats();
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      {newMissionAlert && (
        <div className="sticky top-0 z-50 bg-amber-500 text-white px-4 py-3 flex items-center justify-between gap-4 shadow-lg">
          <span className="font-semibold">
            🔔 {newMissionAlert.count} new mission{newMissionAlert.count > 1 ? 's' : ''} from customers!
          </span>
          <button
            onClick={() => setNewMissionAlert(null)}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg font-medium"
          >
            Close
          </button>
        </div>
      )}

      <header className="bg-slate-800 text-white px-4 py-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <img src="/isa-logo.png" alt="ISA Express" className="h-10 sm:h-12 w-auto object-contain brightness-0 invert" />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Manager ISA</h1>
              <p className="text-slate-300 text-sm">Mission management — ISA Express</p>
            </div>
          </div>
          <div className="flex gap-2">
            {activeTab === 'missions' && (
              <>
                <button
                  onClick={() => setShowCreateMission(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium"
                >
                  <Plus className="w-5 h-5" />
                  Create new mission
                </button>
                <button
                  onClick={() => { refetch(); refetchStats(); }}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg font-medium disabled:opacity-50"
                >
                  <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-4">
        <div className="max-w-7xl mx-auto flex gap-1">
          <button
            onClick={() => setActiveTab('missions')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'missions' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-600 hover:text-slate-800'
            }`}
          >
            <Package className="w-4 h-4" />
            Missions
          </button>
          <button
            onClick={() => setActiveTab('affiliates')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'affiliates' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-600 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            Affiliates
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'users' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-600 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            Users
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        {activeTab === 'affiliates' && <AffiliatesPanel missions={missions} />}
        {activeTab === 'users' && <UsersPanel />}

        {activeTab === 'missions' && (
          <>
            {/* Statistics */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Statistics
              </h2>
              {statsLoading ? (
                <div className="text-slate-500">Loading...</div>
              ) : stats ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                    <div className="text-2xl font-bold text-slate-800">{stats.total}</div>
                    <div className="text-sm text-slate-500">Total missions</div>
                  </div>
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                    <div className="text-2xl font-bold text-indigo-600">{stats.byType?.pickup || 0}</div>
                    <div className="text-sm text-slate-500 flex items-center gap-1"><Truck className="w-3.5 h-3.5" /> Pickup</div>
                  </div>
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                    <div className="text-2xl font-bold text-blue-600">{stats.byType?.empty_box || 0}</div>
                    <div className="text-sm text-slate-500 flex items-center gap-1"><Package className="w-3.5 h-3.5" /> Empty Box</div>
                  </div>
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                    <div className="text-2xl font-bold text-blue-600">{stats.totalBoxes || 0}</div>
                    <div className="text-sm text-slate-500">Total boxes</div>
                  </div>
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                    <div className="text-2xl font-bold text-amber-600 flex items-center gap-1">
                      <AlertTriangle className="w-5 h-5" />
                      {stats.missingAddress || 0}
                    </div>
                    <div className="text-sm text-slate-500">Missing address</div>
                  </div>
                </div>
              ) : null}
            </section>

            {/* Filters */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${showFilters ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'}`}
                >
                  <Filter className="w-4 h-4" />
                  Filters
                  {activeFilterCount > 0 && (
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${showFilters ? 'bg-white text-indigo-600' : 'bg-indigo-600 text-white'}`}>
                      {activeFilterCount}
                    </span>
                  )}
                  {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {activeFilterCount > 0 && (
                  <button onClick={clearFilters} className="flex items-center gap-1 px-2 py-1.5 text-xs text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg border border-slate-200 transition-colors">
                    <X className="w-3.5 h-3.5" /> Clear filters
                  </button>
                )}
              </div>
              {showFilters && (
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-4">
                  {/* Row 1: Sender */}
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer select-none mb-2 w-fit">
                      <input
                        type="checkbox"
                        checked={sectionVisible.sender}
                        onChange={() => toggleSection('sender')}
                        className="w-3.5 h-3.5 accent-indigo-600 cursor-pointer"
                      />
                      <span className={`text-[11px] font-semibold uppercase tracking-wider ${sectionVisible.sender ? 'text-slate-400' : 'text-slate-300 line-through'}`}>
                        Sender
                      </span>
                    </label>
                    {sectionVisible.sender && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        <div>
                          <ColLabel label="Sender name" colKey="sender" vis={visibleColumns} toggle={toggleColumn} />
                          <input type="text" value={filterName} onChange={(e) => setFilterName(e.target.value)} placeholder="Name..." className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                        </div>
                        <div>
                          <ColLabel label="Sender phone" colKey="senderPhone" vis={visibleColumns} toggle={toggleColumn} />
                          <input type="text" value={filterPhone} onChange={(e) => setFilterPhone(e.target.value)} placeholder="050..." className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                        </div>
                        <div>
                          <ColLabel label="Pickup address" colKey="pickupAddr" vis={visibleColumns} toggle={toggleColumn} />
                          <input type="text" value={filterPickupAddr} onChange={(e) => setFilterPickupAddr(e.target.value)} placeholder="Street / city..." className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Row 2: Receiver */}
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer select-none mb-2 w-fit">
                      <input
                        type="checkbox"
                        checked={sectionVisible.receiver}
                        onChange={() => toggleSection('receiver')}
                        className="w-3.5 h-3.5 accent-indigo-600 cursor-pointer"
                      />
                      <span className={`text-[11px] font-semibold uppercase tracking-wider ${sectionVisible.receiver ? 'text-slate-400' : 'text-slate-300 line-through'}`}>
                        Receiver (pickup only)
                      </span>
                    </label>
                    {sectionVisible.receiver && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        <div>
                          <ColLabel label="Receiver name" colKey="receiver" vis={visibleColumns} toggle={toggleColumn} />
                          <input type="text" value={filterReceiverName} onChange={(e) => setFilterReceiverName(e.target.value)} placeholder="Name..." className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                        </div>
                        <div>
                          <ColLabel label="Receiver phone" colKey="receiverPhone" vis={visibleColumns} toggle={toggleColumn} />
                          <input type="text" value={filterReceiverPhone} onChange={(e) => setFilterReceiverPhone(e.target.value)} placeholder="050..." className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                        </div>
                        <div>
                          <ColLabel label="Delivery address" colKey="deliveryAddr" vis={visibleColumns} toggle={toggleColumn} />
                          <input type="text" value={filterDeliveryAddr} onChange={(e) => setFilterDeliveryAddr(e.target.value)} placeholder="Street / city..." className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                        </div>
                        <div>
                          <ColLabel label="Missing info" colKey="missingInfo" vis={visibleColumns} toggle={toggleColumn} />
                          <select value={filterMissingAddress} onChange={(e) => setFilterMissingAddress(e.target.value)} className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                            <option value="">All</option>
                            <option value="yes">Missing address</option>
                            <option value="no">Has address</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Row 3: Mission */}
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Mission</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      <div>
                        <ColLabel label="Type" colKey="type" vis={visibleColumns} toggle={toggleColumn} />
                        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                          <option value="">All types</option>
                          {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </div>
                      <div>
                        <ColLabel label="Status" colKey="status" vis={visibleColumns} toggle={toggleColumn} />
                        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                          <option value="">All statuses</option>
                          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </div>
                      <div>
                        <ColLabel label="Source" colKey="source" vis={visibleColumns} toggle={toggleColumn} />
                        <select value={filterCreatedBy} onChange={(e) => setFilterCreatedBy(e.target.value)} className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                          <option value="">All sources</option>
                          {Object.entries(CREATED_BY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </div>
                      <div>
                        <ColLabel label="Box type" colKey="boxes" vis={visibleColumns} toggle={toggleColumn} />
                        <select value={filterBoxType} onChange={(e) => setFilterBoxType(e.target.value)} className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                          <option value="">All boxes</option>
                          <option value="large">ISA-BOX-70 (Large)</option>
                          <option value="small">ISA-BOX-35 (Small)</option>
                        </select>
                      </div>
                      <div>
                        <ColLabel label="Affiliate" colKey="affiliate" vis={visibleColumns} toggle={toggleColumn} />
                        <select value={filterAffiliate} onChange={(e) => setFilterAffiliate(e.target.value)} className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                          <option value="">All affiliates</option>
                          {affiliates.map((a) => (
                            <option key={a.id} value={a.name}>{a.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <ColLabel label="From date" colKey="date" vis={visibleColumns} toggle={toggleColumn} />
                        <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Table */}
            <section className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              <h2 className="text-lg font-semibold text-slate-800 p-4 border-b flex items-center gap-2">
                <Package className="w-5 h-5" />
                All missions ({filtered.length})
              </h2>

              {error || loading ? (
                <div className="p-8 text-center">
                  {error ? (
                    <p className="text-red-600">Error: {error}. Ensure the server is running.</p>
                  ) : (
                    <p className="text-slate-500">Loading...</p>
                  )}
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-slate-500">No missions to display</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap w-32">ID</th>
                        {visibleColumns.type        && <th className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap w-24">Type</th>}
                        {visibleColumns.status      && <th className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap w-28">Status</th>}
                        {visibleColumns.sender      && <th className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap w-36">Sender</th>}
                        {visibleColumns.pickupAddr  && <th className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap w-44">Pickup Addr</th>}
                        {visibleColumns.receiver    && <th className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap w-36">Receiver</th>}
                        {visibleColumns.deliveryAddr && <th className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap w-44">Delivery Addr</th>}
                        {visibleColumns.boxes       && <th className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap w-24">Boxes</th>}
                        {visibleColumns.source      && <th className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap w-16">Source</th>}
                        {visibleColumns.affiliate   && <th className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap w-28">Affiliate</th>}
                        {visibleColumns.date        && <th className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap w-32">Date</th>}
                        <th className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-16"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((mission) => {
                        const missingAddr = isMissingAddress(mission);
                        return (
                          <tr
                            key={mission.id}
                            className={`border-b border-slate-100 hover:bg-slate-50/60 transition-colors ${missingAddr ? 'bg-amber-50/40' : ''}`}
                          >
                            <td className="px-3 py-3 font-mono font-bold text-blue-600 text-xs whitespace-nowrap">{mission.id}</td>
                            {visibleColumns.type && (
                              <td className="px-3 py-3">
                                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${mission.type === 'pickup' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'}`}>
                                  {mission.type === 'pickup' ? <Truck className="w-3 h-3 shrink-0" /> : <Package className="w-3 h-3 shrink-0" />}
                                  {TYPE_LABELS[mission.type] || mission.type}
                                </span>
                              </td>
                            )}
                            {visibleColumns.status && (
                              <td className="px-3 py-3">
                                <span className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${STATUS_COLORS[mission.status] || 'bg-slate-100 text-slate-600'}`}>
                                  {STATUS_LABELS[mission.status] || mission.status}
                                </span>
                              </td>
                            )}
                            {visibleColumns.sender && (
                              <td className="px-3 py-3 w-36 max-w-[9rem]">
                                <p className="text-sm font-medium text-slate-700 truncate">{mission.fullName || '—'}</p>
                                <p className="text-xs text-slate-400 truncate">{mission.customerPhone || ''}</p>
                              </td>
                            )}
                            {visibleColumns.pickupAddr && (
                              <td className="px-3 py-3 w-44 max-w-[11rem]">
                                {mission.address?.lat ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-slate-600 w-full overflow-hidden">
                                    <MapPin className="w-3 h-3 text-green-500 shrink-0" />
                                    <span className="truncate">{mission.address.displayAddress || '—'}</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded-full whitespace-nowrap">
                                    <AlertTriangle className="w-3 h-3 shrink-0" />
                                    Missing
                                  </span>
                                )}
                              </td>
                            )}
                            {visibleColumns.receiver && (
                              <td className="px-3 py-3 w-36 max-w-[9rem]">
                                {mission.type === 'pickup' ? (
                                  mission.receiverName || mission.receiverPhone ? (
                                    <>
                                      <p className="text-sm font-medium text-slate-700 truncate">{mission.receiverName || '—'}</p>
                                      <p className="text-xs text-slate-400 truncate">{mission.receiverPhone || ''}</p>
                                    </>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded-full whitespace-nowrap">
                                      <AlertTriangle className="w-3 h-3 shrink-0" />
                                      Missing
                                    </span>
                                  )
                                ) : (
                                  <span className="text-slate-300 text-xs">—</span>
                                )}
                              </td>
                            )}
                            {visibleColumns.deliveryAddr && (
                              <td className="px-3 py-3 w-44 max-w-[11rem]">
                                {mission.type === 'pickup' ? (
                                  mission.receiverAddress?.lat ? (
                                    <span className="inline-flex items-center gap-1 text-xs text-slate-600 w-full overflow-hidden">
                                      <MapPin className="w-3 h-3 text-indigo-500 shrink-0" />
                                      <span className="truncate">{mission.receiverAddress.displayAddress || '—'}</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded-full whitespace-nowrap">
                                      <AlertTriangle className="w-3 h-3 shrink-0" />
                                      Missing
                                    </span>
                                  )
                                ) : (
                                  <span className="text-slate-300 text-xs">—</span>
                                )}
                              </td>
                            )}
                            {visibleColumns.boxes && (
                              <td className="px-3 py-3">
                                {mission.boxSelection ? (
                                  <div className="text-xs space-y-0.5">
                                    {mission.boxSelection.large > 0 && (
                                      <div className="flex items-center gap-1 text-blue-700 whitespace-nowrap">
                                        <span className="font-mono bg-blue-100 px-1 rounded">70</span>
                                        <span className="font-bold">×{mission.boxSelection.large}</span>
                                      </div>
                                    )}
                                    {mission.boxSelection.small > 0 && (
                                      <div className="flex items-center gap-1 text-indigo-700 whitespace-nowrap">
                                        <span className="font-mono bg-indigo-100 px-1 rounded">35</span>
                                        <span className="font-bold">×{mission.boxSelection.small}</span>
                                      </div>
                                    )}
                                    {!mission.boxSelection.large && !mission.boxSelection.small && <span className="text-slate-400">—</span>}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 text-sm">—</span>
                                )}
                              </td>
                            )}
                            {visibleColumns.source && (
                              <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">{CREATED_BY_LABELS[mission.createdBy] || mission.createdBy}</td>
                            )}
                            {visibleColumns.affiliate && (
                              <td className="px-3 py-3">
                                {mission.affiliateName ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                                    <Tag className="w-3 h-3 shrink-0" />
                                    {mission.affiliateName}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 text-xs">—</span>
                                )}
                              </td>
                            )}
                            {visibleColumns.date && (
                              <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">
                                {mission.createdAt
                                  ? new Date(mission.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                  : '—'}
                              </td>
                            )}
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-1">
                                {mission.type === 'pickup' && (
                                  <button
                                    onClick={() => setCompletingMission(mission)}
                                    className={`p-1.5 rounded-lg transition-colors ${
                                      mission.receiverAddress?.lat
                                        ? 'text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50'
                                        : 'text-red-400 hover:text-red-600 hover:bg-red-50'
                                    }`}
                                    title={mission.receiverAddress?.lat ? 'Delivery details complete' : 'Complete delivery details'}
                                  >
                                    <Truck className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => setEditingMission(mission)}
                                  className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
                                  title="Edit mission"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(mission.id)}
                                  disabled={deletingId === mission.id}
                                  className="p-1.5 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-600 transition-colors disabled:opacity-50"
                                  title="Delete mission"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* Mission edit modal */}
      {editingMission && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto"
          onClick={() => setEditingMission(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-bold text-slate-800 text-lg">Edit Mission — {editingMission.id}</h2>
              <button onClick={() => setEditingMission(null)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="px-6 py-4">
              <MissionDetails
                mission={editingMission}
                onSave={() => { refetch(); refetchStats(); setEditingMission(null); }}
                onClose={() => setEditingMission(null)}
                onDelete={() => { refetch(); refetchStats(); setEditingMission(null); }}
              />
            </div>
          </div>
        </div>
      )}

      <CreateMissionModal
        isOpen={showCreateMission}
        onClose={() => setShowCreateMission(false)}
        onCreated={() => { refetch(); refetchStats(); setShowCreateMission(false); }}
      />

      {completingMission && (
        <CompleteDeliveryModal
          isOpen
          mission={completingMission}
          onClose={() => setCompletingMission(null)}
          onSaved={() => { refetch(); refetchStats(); setCompletingMission(null); }}
        />
      )}
    </div>
  );
}
