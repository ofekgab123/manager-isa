import { useState, useEffect, useCallback } from 'react';
import {
  Package,
  Box,
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
  UserCircle2,
  MapPin,
  Tag,
  BarChart2,
  Info,
  Check,
  List,
  LogOut,
  ShieldCheck,
  MessageSquare,
} from 'lucide-react';
import CreateMissionModal from './components/CreateMissionModal';
import EmptyBoxMissionPickerModal from './components/EmptyBoxMissionPickerModal';
import PickupMissionPickerModal from './components/PickupMissionPickerModal';
import MissionDetails from './components/MissionDetails';
import CompleteDeliveryModal from './components/CompleteDeliveryModal';
import MissionPreviewModal from './components/MissionPreviewModal';
import AffiliatesPanel from './components/AffiliatesPanel';
import CustomersPanel from './components/CustomersPanel';
import UsersPanel from './components/UsersPanel';
import StatisticsPanel from './components/StatisticsPanel';
import ContainersPanel from './components/ContainersPanel';
import SettingsPanel from './components/SettingsPanel';
import LeadsPanel from './components/LeadsPanel';
import LeadReplyAlertLayer from './components/LeadReplyAlertLayer';
import TableHorizontalScroll from './components/TableHorizontalScroll';
import LoginPage from './components/LoginPage';
import { API_BASE } from './config';
import { canAccessLeads } from './authCountryUtils';
import { shippingDestinationLabel, missionLwRegionId, isMissingThailandPayment } from './shippingDestinations';

const TYPE_LABELS = {
  pickup: 'Pickup',
  empty_box: 'Empty Box',
};

/** LionWheel task status codes (tasks/show) — must match server lionWheelTaskStatusLabel */
const CREATED_BY_LABELS = {
  customer: 'Customer',
  customer_service: 'CS',
};

function lwStatusBadgeClasses(code) {
  if (typeof code !== 'number') return 'bg-slate-100 text-slate-600 border border-slate-200';
  if (code === 3 || code === 5) return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
  if (code === 4 || code === 8 || code === 9) return 'bg-red-100 text-red-800 border border-red-200';
  if (code === 2 || code === 1) return 'bg-blue-100 text-blue-800 border border-blue-200';
  if (code === 0) return 'bg-slate-100 text-slate-700 border border-slate-200';
  return 'bg-indigo-50 text-indigo-800 border border-indigo-200';
}

function useMissions() {
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMissions = async (opts = {}) => {
    const silent = opts.silent === true;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/missions`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setMissions(data);
    } catch (e) {
      setError(e.message);
      setMissions([]);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchMissions();
    /** Pick up DB changes (e.g. LionWheel webhooks) without full page refresh. */
    const interval = setInterval(() => fetchMissions({ silent: true }), 60_000);
    return () => clearInterval(interval);
  }, []);

  return {
    missions,
    loading,
    error,
    refetch: () => fetchMissions({ silent: true }),
  };
}

function useMissionStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = (silent = false) => {
    if (!silent) setLoading(true);
    return fetch(`${API_BASE}/missions/stats`)
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(() => {})
      .finally(() => {
        if (!silent) setLoading(false);
      });
  };

  useEffect(() => {
    fetchStats(false);
  }, []);

  return { stats, loading, refetch: () => fetchStats(true) };
}

const isMissingAddress = (m) => m.type === 'pickup' ? !m.receiverAddress?.lat : !m.address?.lat;
const needsDeliveryDetails = (m) => isMissingAddress(m) || isMissingThailandPayment(m);

function missionTrackingIds(m) {
  if (m.type !== 'pickup') return [];
  const deliveries = m.deliveries?.length > 0 ? m.deliveries : [];
  return deliveries.flatMap((d) => [
    ...(d.boxTrackingIds ?? []),
    ...(d.boxThailandRefs ?? []),
  ]).map((t) => String(t).trim()).filter(Boolean);
}

function missionMatchesTrackingFilter(m, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return missionTrackingIds(m).some((tid) => tid.toLowerCase().includes(q));
}

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
  const [authUser, setAuthUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('isa_auth_token');
    if (!token) { setAuthChecked(true); return; }
    fetch(`${API_BASE}/auth/me`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((u) => setAuthUser({ username: u.username, isAdmin: u.isAdmin, country: u.country || null }))
      .catch(() => {
        localStorage.removeItem('isa_auth_token');
      })
      .finally(() => setAuthChecked(true));
  }, []);

  const handleLogin = ({ token, username, isAdmin, country }) => {
    localStorage.setItem('isa_auth_token', token);
    setAuthUser({ username, isAdmin, country: country || null });
  };

  const handleLogout = () => {
    localStorage.removeItem('isa_auth_token');
    setAuthUser(null);
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen gradient-header flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-12 h-12 border-3 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
          <p className="text-white/70 text-base font-medium tracking-wide">Loading...</p>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return <Dashboard authUser={authUser} onLogout={handleLogout} />;
}

function Dashboard({ authUser, onLogout }) {
  const [activeTab, setActiveTab] = useState('missions');
  const [leadsOpenLeadId, setLeadsOpenLeadId] = useState(null);
  const [leadsReplyCount, setLeadsReplyCount] = useState(0);
  const showLeadsTab = canAccessLeads(authUser);
  const affiliates = useAffiliates();

  const { missions, loading, error, refetch } = useMissions();
  const { stats, loading: statsLoading, refetch: refetchStats } = useMissionStats();

  const [listRefreshing, setListRefreshing] = useState(false);
  const [lwSyncing, setLwSyncing] = useState(false);
  const handleHeaderRefresh = () => {
    setListRefreshing(true);
    return Promise.all([refetch(), refetchStats()]).finally(() => setListRefreshing(false));
  };
  const handleLwSync = async () => {
    if (lwSyncing) return;
    setLwSyncing(true);
    try {
      const res = await fetch(`${API_BASE}/lionwheel/sync-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(data.error || 'LionWheel sync failed');
        return;
      }
      await Promise.all([refetch(), refetchStats()]);
      const lines = [
        `Checked: ${data.checked ?? 0}`,
        `Updated: ${data.updated ?? 0}`,
        `Unchanged: ${data.unchanged ?? 0}`,
        `Failed: ${data.failed ?? 0}`,
      ];
      if (Array.isArray(data.updates) && data.updates.length > 0) {
        lines.push('', 'Changes:');
        for (const u of data.updates.slice(0, 8)) {
          lines.push(`• ${u.missionId}: ${u.fromLabel ?? u.from ?? '—'} → ${u.toLabel ?? u.to}`);
        }
        if (data.updates.length > 8) lines.push(`… and ${data.updates.length - 8} more`);
      }
      window.alert(lines.join('\n'));
    } catch (e) {
      window.alert(e.message || 'LionWheel sync failed');
    } finally {
      setLwSyncing(false);
    }
  };

  const [containers, setContainers] = useState([]);
  const [capacityAlertDismissed, setCapacityAlertDismissed] = useState(false);
  const fetchContainers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/containers`);
      if (res.ok) setContainers(await res.json());
    } catch {}
  }, []);
  useEffect(() => {
    fetchContainers();
    const interval = setInterval(fetchContainers, 10000);
    return () => clearInterval(interval);
  }, [fetchContainers]);

  useEffect(() => {
    if (!showLeadsTab && activeTab === 'leads') {
      setActiveTab('missions');
    }
  }, [showLeadsTab, activeTab]);
  const packagesByContainer = missions.reduce((acc, m) => {
    if (m.type === 'pickup' && m.containerId) acc[m.containerId] = (acc[m.containerId] || 0) + 1;
    return acc;
  }, {});
  const containersOver70 = containers
    .map((c) => {
      const count = packagesByContainer[c.id] || 0;
      const pct = c.maxPackages > 0 ? Math.round((count / c.maxPackages) * 100) : 0;
      return { ...c, packagesCount: count, capacityPercent: pct };
    })
    .filter((c) => c.capacityPercent >= 70);
  const showCapacityFloating = containersOver70.length > 0 && !capacityAlertDismissed;

  const [filterName, setFilterName] = useState('');
  const [filterPhone, setFilterPhone] = useState('');
  const [filterTrackingId, setFilterTrackingId] = useState('');

  const [visibleColumns] = useState({
    type: true, sender: true, pickupAddr: true, shipTo: true,
    receiver: true, deliveryAddr: true, boxes: true, source: true, date: true, affiliate: true,
    senderPhone: true, receiverPhone: true, missingInfo: true, trackingId: true, lwTaskId: true, lwStatus: true,
  });

  const [showFilters, setShowFilters] = useState(false);
  const [editingMission, setEditingMission] = useState(null);
  const [previewMission, setPreviewMission] = useState(null);
  const [previewMissionSecondary, setPreviewMissionSecondary] = useState(null);
  const [linkingMission, setLinkingMission] = useState(null);
  const [linkingPickupToEmptyBoxMission, setLinkingPickupToEmptyBoxMission] = useState(null);
  const [pickupLinkRefreshKey, setPickupLinkRefreshKey] = useState(0);
  const [pickupPickerDataKey, setPickupPickerDataKey] = useState(0);
  const [completingMission, setCompletingMission] = useState(null);
  const [showCreateMission, setShowCreateMission] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const activeFilterCount = [filterName, filterPhone, filterTrackingId].filter(Boolean).length;

  const filtered = missions.filter((m) => {
    if (filterName && !(m.fullName || '').toLowerCase().includes(filterName.toLowerCase())) return false;
    if (filterPhone && !(m.customerPhone || '').replace(/\D/g, '').includes(filterPhone.replace(/\D/g, ''))) return false;
    if (!missionMatchesTrackingFilter(m, filterTrackingId)) return false;
    return true;
  });

  const clearFilters = () => {
    setFilterName('');
    setFilterPhone('');
    setFilterTrackingId('');
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
    <div className={`min-h-screen bg-slate-50 ${showCapacityFloating ? 'pt-14' : ''}`}>
      {showCapacityFloating && (
        <div className="fixed top-0 left-0 right-0 z-[100] shadow-lg animate-slide-up"
             style={{ background: 'linear-gradient(135deg, #991b1b 0%, #dc2626 50%, #ef4444 100%)' }}>
          <div className="px-5 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap justify-center flex-1">
              <p className="text-sm font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Capacity alert:
              </p>
              {containersOver70.map((c) => (
                <span key={c.id} className="text-sm text-red-100 font-medium bg-white/15 px-2.5 py-0.5 rounded-full">
                  {c.name || c.id} <span className="font-bold text-white">{c.capacityPercent}%</span>
                </span>
              ))}
            </div>
            <button
              onClick={() => setCapacityAlertDismissed(true)}
              className="flex items-center justify-center gap-1.5 px-4 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-xl text-sm font-semibold shrink-0 transition-all duration-200 backdrop-blur-sm"
            >
              <Check className="w-4 h-4" />
              Dismiss
            </button>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-40 shadow-lg" style={{ background: 'linear-gradient(135deg, #3730a3 0%, #4f46e5 50%, #6366f1 100%)' }}>
        <div className="px-5 py-3.5 text-white">
        <div className="mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-5">
            <img src="/isa-logo.png" alt="ISA Express" className="h-12 sm:h-14 w-auto object-contain brightness-0 invert drop-shadow-lg" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Manager ISA</h1>
              <p className="text-indigo-200/80 text-sm font-medium mt-0.5">Mission management — ISA Express</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {activeTab === 'missions' && (
              <>
                <button
                  onClick={() => setShowCreateMission(true)}
                  className="btn-amber"
                >
                  <Plus className="w-5 h-5" />
                  Create new mission
                </button>
                <button
                  type="button"
                  onClick={() => { handleHeaderRefresh(); }}
                  disabled={loading || listRefreshing || lwSyncing}
                  className="btn-secondary !bg-white/10 !border-white/20 !text-white hover:!bg-white/20 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${listRefreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </>
            )}
            <button
              type="button"
              onClick={handleLwSync}
              disabled={lwSyncing || listRefreshing}
              className="btn-secondary !bg-white/10 !border-white/20 !text-white hover:!bg-white/20 disabled:opacity-50"
              title="Fetch latest LionWheel status from API"
            >
              <RefreshCw className={`w-4 h-4 ${lwSyncing ? 'animate-spin' : ''}`} />
              Sync LionWheel
            </button>
            <div className="flex items-center gap-2.5 pl-3 border-l border-white/20 ml-1">
              <span className="flex items-center gap-1.5 text-sm text-indigo-200">
                {authUser.isAdmin && <ShieldCheck className="w-4 h-4 text-amber-400" />}
                <span className="font-medium">{authUser.username}</span>
                {authUser.country && (
                  <span className="ml-1 px-2 py-0.5 bg-white/15 rounded-full text-xs font-semibold text-white">
                    {authUser.country}
                  </span>
                )}
              </span>
              <button
                onClick={onLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-medium transition-all duration-200"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          </div>
        </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200/80 px-5 py-2.5 shadow-sm">
        <div className="flex gap-1.5 overflow-x-auto bg-slate-100 rounded-xl p-1">
          <button
            onClick={() => setActiveTab('missions')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-200 whitespace-nowrap ${
              activeTab === 'missions' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-800 hover:bg-white/60'
            }`}
          >
            <Package className="w-4 h-4" />
            Missions
          </button>
          <button
            onClick={() => setActiveTab('containers')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-200 whitespace-nowrap ${
              activeTab === 'containers' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-800 hover:bg-white/60'
            }`}
          >
            <Box className="w-4 h-4" />
            Containers
          </button>
          <button
            onClick={() => setActiveTab('affiliates')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-200 whitespace-nowrap ${
              activeTab === 'affiliates' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-800 hover:bg-white/60'
            }`}
          >
            <Users className="w-4 h-4" />
            Affiliates
          </button>
          <button
            onClick={() => setActiveTab('customers')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-200 whitespace-nowrap ${
              activeTab === 'customers' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-800 hover:bg-white/60'
            }`}
          >
            <UserCircle2 className="w-4 h-4" />
            Customers
          </button>
          {showLeadsTab && (
            <button
              onClick={() => setActiveTab('leads')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-200 whitespace-nowrap ${
                activeTab === 'leads' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-800 hover:bg-white/60'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Leads
              {leadsReplyCount > 0 && (
                <span
                  className={`min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] font-bold leading-none flex items-center justify-center shrink-0 ${
                    activeTab === 'leads' ? 'bg-amber-300 text-amber-950' : 'bg-amber-500 text-white animate-pulse'
                  }`}
                >
                  {leadsReplyCount > 9 ? '9+' : leadsReplyCount}
                </span>
              )}
            </button>
          )}
          {authUser.isAdmin && (
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-200 whitespace-nowrap ${
                activeTab === 'users' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-800 hover:bg-white/60'
              }`}
            >
              <Users className="w-4 h-4" />
              Users
            </button>
          )}
          <button
            onClick={() => setActiveTab('statistics')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-200 whitespace-nowrap ${
              activeTab === 'statistics' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-800 hover:bg-white/60'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            Statistics
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-200 whitespace-nowrap ${
              activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-800 hover:bg-white/60'
            }`}
          >
            <List className="w-4 h-4" />
            Settings
          </button>
        </div>
      </div>

      <main className="px-2 py-4 sm:px-4 sm:py-5">
        {activeTab === 'containers' && <ContainersPanel />}
        {activeTab === 'affiliates' && <AffiliatesPanel missions={missions} />}
        {activeTab === 'customers' && <CustomersPanel />}
        {showLeadsTab && activeTab === 'leads' && (
          <LeadsPanel
            authUser={authUser}
            openLeadId={leadsOpenLeadId}
            onOpenLeadHandled={() => setLeadsOpenLeadId(null)}
          />
        )}
        {activeTab === 'users' && authUser.isAdmin && <UsersPanel />}
        {activeTab === 'statistics' && (
          <StatisticsPanel
            missions={missions}
            affiliates={affiliates}
            onRefresh={handleHeaderRefresh}
            loading={loading || listRefreshing}
          />
        )}
        {activeTab === 'settings' && <SettingsPanel authUser={authUser} />}

        {activeTab === 'missions' && (
          <>
            {/* Statistics */}
            <section className="mb-8 animate-fade-in">
              <h2 className="section-title mb-5">
                <TrendingUp className="w-5 h-5 text-indigo-500" />
                Statistics
              </h2>
              {statsLoading ? (
                <div className="text-slate-400 text-sm">Loading...</div>
              ) : stats ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
                  <div className="stat-card border-l-4 border-l-slate-400">
                    <div className="text-3xl font-extrabold text-slate-800">{stats.total}</div>
                    <div className="text-sm text-slate-500 mt-1 font-medium">Total missions</div>
                  </div>
                  <div className="stat-card border-l-4 border-l-indigo-500">
                    <div className="text-3xl font-extrabold text-indigo-600">{stats.byType?.pickup || 0}</div>
                    <div className="text-sm text-slate-500 mt-1 font-medium flex items-center gap-1.5"><Truck className="w-3.5 h-3.5 text-indigo-400" /> Pickup</div>
                  </div>
                  <div className="stat-card border-l-4 border-l-blue-500">
                    <div className="text-3xl font-extrabold text-blue-600">{stats.byType?.empty_box || 0}</div>
                    <div className="text-sm text-slate-500 mt-1 font-medium flex items-center gap-1.5"><Package className="w-3.5 h-3.5 text-blue-400" /> Empty Box</div>
                  </div>
                  <div className="stat-card border-l-4 border-l-cyan-500">
                    <div className="text-3xl font-extrabold text-cyan-600">{stats.totalBoxes || 0}</div>
                    <div className="text-sm text-slate-500 mt-1 font-medium">Total boxes</div>
                  </div>
                  <div className="stat-card border-l-4 border-l-amber-500">
                    <div className="text-3xl font-extrabold text-amber-600 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5" />
                      {stats.missingAddress || 0}
                    </div>
                    <div className="text-sm text-slate-500 mt-1 font-medium">Missing address</div>
                  </div>
                </div>
              ) : null}
            </section>

            {/* Filters */}
            <div className="mb-5">
              <div className="flex items-center gap-2.5 mb-3">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-sm ${showFilters ? 'bg-indigo-600 text-white shadow-indigo-200' : 'bg-white border border-slate-200 hover:border-slate-300 text-slate-700 hover:shadow-md'}`}
                >
                  <Filter className="w-4 h-4" />
                  Filters
                  {activeFilterCount > 0 && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${showFilters ? 'bg-white text-indigo-600' : 'bg-indigo-600 text-white'}`}>
                      {activeFilterCount}
                    </span>
                  )}
                  {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {activeFilterCount > 0 && (
                  <button onClick={clearFilters} className="btn-secondary !px-3 !py-2 text-xs text-slate-500 hover:!text-red-600 hover:!border-red-200 hover:!bg-red-50">
                    <X className="w-3.5 h-3.5" /> Clear filters
                  </button>
                )}
              </div>
              {showFilters && (
                <div className="card p-5 animate-slide-up">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="label">Sender name</label>
                      <input
                        type="text"
                        value={filterName}
                        onChange={(e) => setFilterName(e.target.value)}
                        placeholder="Name..."
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="label">Sender phone</label>
                      <input
                        type="text"
                        value={filterPhone}
                        onChange={(e) => setFilterPhone(e.target.value)}
                        placeholder="050..."
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="label">Tracking number</label>
                      <input
                        type="text"
                        value={filterTrackingId}
                        onChange={(e) => setFilterTrackingId(e.target.value)}
                        placeholder="Tracking ID..."
                        className="input-field"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Table */}
            <section className="card animate-fade-in">
              <h2 className="section-title p-5 border-b border-slate-100">
                <Package className="w-5 h-5 text-indigo-500" />
                All missions
                <span className="text-sm font-medium text-slate-400 ml-1">({filtered.length})</span>
              </h2>

              {error || loading ? (
                <div className="p-10 text-center">
                  {error ? (
                    <p className="text-red-600 font-medium">Error: {error}. Ensure the server is running.</p>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
                      <p className="text-slate-400 text-sm">Loading missions...</p>
                    </div>
                  )}
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-10 text-center text-slate-400 text-sm">No missions to display</div>
              ) : (
                <div className="px-2 pb-4">
                  <table className="w-full text-center table-fixed text-xs">
                    <thead>
                      <tr className="table-header">
                        <th className="min-w-[7rem]">ID</th>
                        {visibleColumns.type        && <th className="min-w-[5rem]">Type</th>}
                        {visibleColumns.lwStatus    && <th className="min-w-[7rem]">LW Status</th>}
                        {visibleColumns.trackingId  && <th className="min-w-[5rem]">Tracking</th>}
                        {visibleColumns.sender      && <th className="min-w-[7rem]">Sender</th>}
                        {visibleColumns.pickupAddr  && <th className="min-w-[9rem]">Pickup Addr</th>}
                        {visibleColumns.shipTo      && <th className="min-w-[4rem]">Ship to</th>}
                        {visibleColumns.receiver    && <th className="min-w-[7rem]">Receiver</th>}
                        {visibleColumns.deliveryAddr && <th className="min-w-[9rem]">Delivery Addr</th>}
                        {visibleColumns.boxes       && <th className="min-w-[4rem]">Boxes</th>}
                        {visibleColumns.source      && <th className="min-w-[3.5rem]">Source</th>}
                        {visibleColumns.affiliate   && <th className="min-w-[5rem]">Affiliate</th>}
                        {visibleColumns.date        && <th className="min-w-[6rem]">Date</th>}
                        {visibleColumns.lwTaskId    && <th className="min-w-[6rem]">LW ID</th>}
                        <th className="min-w-[3.5rem]"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((mission) => {
                        const missingAddr = isMissingAddress(mission);
                        const missingDeliveryDetails = needsDeliveryDetails(mission);
                        return (
                          <tr
                            key={mission.id}
                            className={`table-row ${missingDeliveryDetails ? 'row-warning' : ''}`}
                          >
                            <td className="whitespace-nowrap">
                              <span className="table-id">{mission.id}</span>
                              {mission.lionwheel?.taskId && (
                                <div className="font-mono text-xs text-indigo-600 mt-0.5 flex items-center gap-1">
                                  <span className="text-slate-400">LW</span>
                                  {mission.lionwheel.trackingLink ? (
                                    <a href={mission.lionwheel.trackingLink} target="_blank" rel="noopener noreferrer" className="hover:underline" title="Open LionWheel tracking">
                                      {mission.lionwheel.taskId}
                                    </a>
                                  ) : (
                                    <span>{mission.lionwheel.taskId}</span>
                                  )}
                                </div>
                              )}
                            </td>
                            {visibleColumns.type && (
                              <td>
                                <span className={`badge-pill ${mission.type === 'pickup' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                  {mission.type === 'pickup' ? <Truck className="w-3.5 h-3.5 shrink-0" /> : <Package className="w-3.5 h-3.5 shrink-0" />}
                                  {TYPE_LABELS[mission.type] || mission.type}
                                </span>
                              </td>
                            )}
                            {visibleColumns.lwStatus && (
                              <td className="overflow-hidden">
                                {mission.lionwheel?.syncError ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                                    Sync failed
                                  </span>
                                ) : (() => {
                                  const lw = mission.lionwheel;
                                  const code =
                                    lw && typeof lw.taskStatus === 'number' && Number.isFinite(lw.taskStatus)
                                      ? lw.taskStatus
                                      : null;
                                  const label =
                                    lw?.taskStatusLabel && String(lw.taskStatusLabel).trim()
                                      ? String(lw.taskStatusLabel).trim()
                                      : null;
                                  const hasStoredStatus = code != null || (label != null && label !== '—');

                                  if (hasStoredStatus) {
                                    const badgeClass =
                                      code != null ? lwStatusBadgeClasses(code) : 'bg-slate-100 text-slate-600 border border-slate-200';
                                    const titleBits = [];
                                    if (code != null) titleBits.push(`Code ${code}`);
                                    if (lw?.taskStatusFetchError)
                                      titleBits.push(`Last API refresh: ${lw.taskStatusFetchError}`);
                                    return (
                                      <span
                                        title={titleBits.join(' · ') || undefined}
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium max-w-[11rem] ${badgeClass} ${lw?.taskStatusFetchError ? 'ring-1 ring-amber-300/80' : ''}`}
                                      >
                                        <span className="truncate">{label ?? `Code ${code}`}</span>
                                      </span>
                                    );
                                  }

                                  if (lw?.taskStatusFetchError) {
                                    return (
                                      <span
                                        title={lw.taskStatusFetchError}
                                        className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium bg-amber-100 text-amber-900 border border-amber-200 max-w-[9rem] truncate cursor-help"
                                      >
                                        LW status unavailable
                                      </span>
                                    );
                                  }

                                  if (lw?.taskId) {
                                    return <span className="text-xs text-slate-400">Pending…</span>;
                                  }

                                  return <span className="text-slate-300 text-sm">—</span>;
                                })()}
                              </td>
                            )}
                            {visibleColumns.trackingId && (
                              <td className="max-w-[9rem]">
                                {mission.type === 'pickup' ? (() => {
                                  const ids = missionTrackingIds(mission);
                                  return ids.length > 0 ? (
                                    <div className="flex flex-col gap-0.5">
                                      {ids.map((tid, i) => (
                                        <span key={i} className="font-mono text-xs text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded truncate block" title={tid}>
                                          {tid}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-slate-300 text-sm">—</span>
                                  );
                                })() : (
                                  <span className="text-slate-300 text-sm">—</span>
                                )}
                              </td>
                            )}
                            {visibleColumns.sender && (
                              <td className="overflow-hidden">
                                <p className="text-xs font-semibold text-slate-700 truncate">{mission.fullName || '—'}</p>
                                <p className="text-xs text-slate-400 truncate">{mission.customerPhone || ''}</p>
                              </td>
                            )}
                            {visibleColumns.pickupAddr && (
                              <td className="overflow-hidden">
                                {mission.address?.lat ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-slate-600 w-full overflow-hidden">
                                    <MapPin className="w-3 h-3 text-green-500 shrink-0" />
                                    <span className="truncate">{mission.address.displayAddress || '—'}</span>
                                  </span>
                                ) : (
                                  <span className="badge-pill bg-amber-100 text-amber-700">
                                    <AlertTriangle className="w-3 h-3 shrink-0" />
                                    Missing
                                  </span>
                                )}
                              </td>
                            )}
                            {visibleColumns.shipTo && (
                              <td>
                                {missionLwRegionId(mission) ? (
                                  <span className="text-xs font-medium text-slate-700 truncate block">
                                    {shippingDestinationLabel(missionLwRegionId(mission))}
                                  </span>
                                ) : mission.type === 'empty_box' ? (
                                  <span className="text-xs text-amber-600">—</span>
                                ) : (
                                  <span className="text-slate-300 text-xs">—</span>
                                )}
                              </td>
                            )}
                            {visibleColumns.receiver && (
                              <td className="overflow-hidden">
                                {mission.type === 'pickup' ? (
                                  mission.receiverName || mission.receiverPhone ? (
                                    <>
                                      <p className="text-xs font-semibold text-slate-700 truncate">{mission.receiverName || '—'}</p>
                                      <p className="text-xs text-slate-400 truncate">{mission.receiverPhone || ''}</p>
                                    </>
                                  ) : (
                                    <span className="badge-pill bg-amber-100 text-amber-700">
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
                              <td className="overflow-hidden">
                                {mission.type === 'pickup' ? (
                                  mission.receiverAddress?.lat ? (
                                    <span className="inline-flex items-center gap-1 text-xs text-slate-600 w-full overflow-hidden">
                                      <MapPin className="w-3 h-3 text-indigo-500 shrink-0" />
                                      <span className="truncate">{mission.receiverAddress.displayAddress || '—'}</span>
                                    </span>
                                  ) : (
                                    <span className="badge-pill bg-amber-100 text-amber-700">
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
                              <td>
                                {mission.boxSelection ? (
                                  <div className="text-sm space-y-0.5">
                                    {mission.boxSelection.large > 0 && (
                                      <div className="flex items-center justify-center gap-1 text-blue-700 whitespace-nowrap">
                                        <span className="font-mono bg-blue-100 px-1.5 rounded text-xs">70</span>
                                        <span className="font-bold">×{mission.boxSelection.large}</span>
                                      </div>
                                    )}
                                    {mission.boxSelection.small > 0 && (
                                      <div className="flex items-center justify-center gap-1 text-indigo-700 whitespace-nowrap">
                                        <span className="font-mono bg-indigo-100 px-1.5 rounded text-xs">35</span>
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
                              <td className="text-xs text-slate-500 font-medium truncate">{CREATED_BY_LABELS[mission.createdBy] || mission.createdBy}</td>
                            )}
                            {visibleColumns.affiliate && (
                              <td>
                                {mission.type === 'pickup' && mission.affiliateName ? (
                                  <span className="badge-pill text-indigo-700 bg-indigo-50 border border-indigo-200">
                                    <Tag className="w-3.5 h-3.5 shrink-0" />
                                    {mission.affiliateName}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 text-sm">—</span>
                                )}
                              </td>
                            )}
                            {visibleColumns.date && (
                              <td className="text-xs text-slate-500 whitespace-nowrap">
                                {mission.createdAt
                                  ? new Date(mission.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })
                                  : '—'}
                              </td>
                            )}
                            {visibleColumns.lwTaskId && (
                              <td className="whitespace-nowrap">
                                {mission.lionwheel?.taskId ? (
                                  <span className="font-mono text-xs text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                    {mission.lionwheel.taskId}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 text-sm">—</span>
                                )}
                              </td>
                            )}
                            <td>
                              <div className="table-actions">
                                <button
                                  onClick={() => setPreviewMission(mission)}
                                  className="action-btn text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"
                                  title="Mission preview"
                                >
                                  <Info className="w-4 h-4" />
                                </button>
                                {mission.type === 'empty_box' && (
                                  <button
                                    type="button"
                                    onClick={() => setLinkingPickupToEmptyBoxMission(mission)}
                                    className="action-btn text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"
                                    title="Link pickup mission"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </button>
                                )}
                                {mission.type === 'pickup' && (
                                  <button
                                    onClick={() => setCompletingMission(mission)}
                                    className={`action-btn ${
                                      needsDeliveryDetails(mission)
                                        ? 'text-red-400 hover:text-red-600 hover:bg-red-50'
                                        : 'text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50'
                                    }`}
                                    title={
                                      needsDeliveryDetails(mission)
                                        ? (isMissingThailandPayment(mission) && mission.receiverAddress?.lat
                                            ? 'Select payment location'
                                            : 'Complete delivery details')
                                        : 'Delivery details complete'
                                    }
                                  >
                                    <Truck className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => setEditingMission(mission)}
                                  className="action-btn text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                  title="Edit mission"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(mission.id)}
                                  disabled={deletingId === mission.id}
                                  className="action-btn text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
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
          className="modal-overlay z-50 !items-start overflow-y-auto"
          onClick={() => setEditingMission(null)}
        >
          <div
            className="modal-content max-w-2xl my-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="font-bold text-slate-800 text-lg">Edit Mission — {editingMission.id}</h2>
              <button onClick={() => setEditingMission(null)} className="action-btn hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="modal-body">
              <MissionDetails
                mission={editingMission}
                onSave={() => { refetch(); refetchStats(); setEditingMission(null); }}
                onClose={() => setEditingMission(null)}
                onDelete={() => { refetch(); refetchStats(); setEditingMission(null); }}
                onOpenPreview={setPreviewMission}
              />
            </div>
          </div>
        </div>
      )}

      <CreateMissionModal
        isOpen={showCreateMission}
        onClose={() => setShowCreateMission(false)}
        onCreated={() => { refetch(); refetchStats(); }}
        authCountry={authUser.country}
      />

      {(previewMission || previewMissionSecondary) && (
        <div
          className="modal-overlay z-50 !items-start overflow-y-auto"
          onClick={() => { setPreviewMission(null); setPreviewMissionSecondary(null); }}
        >
          <div className="flex items-start justify-center gap-4 flex-wrap my-6" onClick={(e) => e.stopPropagation()}>
            {previewMission && (
              <MissionPreviewModal
                mission={previewMission}
                onClose={() => setPreviewMission(null)}
                onOpenLinkedPreview={setPreviewMissionSecondary}
                onRequestLinkEmptyBox={setLinkingMission}
                onRequestLinkPickup={setLinkingPickupToEmptyBoxMission}
                pickupLinkRefreshKey={pickupLinkRefreshKey}
                embedded
                compact={!!previewMissionSecondary}
              />
            )}
            {previewMissionSecondary && (
              <MissionPreviewModal
                mission={previewMissionSecondary}
                onClose={() => setPreviewMissionSecondary(null)}
                onOpenLinkedPreview={setPreviewMissionSecondary}
                onRequestLinkEmptyBox={setLinkingMission}
                onRequestLinkPickup={setLinkingPickupToEmptyBoxMission}
                pickupLinkRefreshKey={pickupLinkRefreshKey}
                embedded
                compact
              />
            )}
          </div>
        </div>
      )}

      <EmptyBoxMissionPickerModal
        isOpen={!!linkingMission}
        onClose={() => setLinkingMission(null)}
        onSelect={async (m) => {
          if (!linkingMission) return;
          try {
            const res = await fetch(`${API_BASE}/missions/${linkingMission.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ linkedEmptyBoxMissionId: m?.id || null }),
            });
            if (res.ok) {
              const updated = await res.json();
              if (previewMission && previewMission.id === linkingMission.id) setPreviewMission(updated);
              if (previewMissionSecondary && previewMissionSecondary.id === linkingMission.id) setPreviewMissionSecondary(updated);
              if (editingMission && editingMission.id === linkingMission.id) setEditingMission(updated);
              refetch();
              refetchStats();
            }
          } catch {}
          setLinkingMission(null);
        }}
      />

      <PickupMissionPickerModal
        isOpen={!!linkingPickupToEmptyBoxMission}
        onClose={() => setLinkingPickupToEmptyBoxMission(null)}
        emptyBoxMissionId={linkingPickupToEmptyBoxMission?.id}
        dataRefreshKey={pickupPickerDataKey}
        onPreviewPickup={(m) => {
          setPreviewMission(m);
          setLinkingPickupToEmptyBoxMission(null);
        }}
        onLinksChanged={() => {
          setPickupPickerDataKey((k) => k + 1);
          setPickupLinkRefreshKey((k) => k + 1);
          refetch();
          refetchStats();
        }}
        onSelect={async (pickup) => {
          if (!linkingPickupToEmptyBoxMission || !pickup?.id) return;
          try {
            const res = await fetch(`${API_BASE}/missions/${pickup.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ linkedEmptyBoxMissionId: linkingPickupToEmptyBoxMission.id }),
            });
            if (res.ok) {
              setPickupPickerDataKey((k) => k + 1);
              setPickupLinkRefreshKey((k) => k + 1);
              refetch();
              refetchStats();
            } else {
              let msg = 'Could not link pickup';
              try {
                const j = await res.json();
                if (j.error) msg = j.error;
              } catch {}
              window.alert(msg);
            }
          } catch {}
        }}
      />

      {completingMission && (
        <CompleteDeliveryModal
          isOpen
          mission={completingMission}
          authCountry={authUser.country}
          onClose={() => setCompletingMission(null)}
          onSaved={() => { refetch(); refetchStats(); setCompletingMission(null); }}
        />
      )}

      {showLeadsTab && (
        <LeadReplyAlertLayer
          enabled={showLeadsTab}
          onReplyCountChange={setLeadsReplyCount}
          onOpenLead={(leadId) => {
            setActiveTab('leads');
            setLeadsOpenLeadId(leadId);
          }}
        />
      )}
    </div>
  );
}
