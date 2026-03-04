import { useState, useEffect } from 'react';
import {
  Package,
  TrendingUp,
  RefreshCw,
  Filter,
  ChevronDown,
  ChevronUp,
  PhoneCall,
  PhoneOff,
  Plus,
  Pencil,
  X,
  ClipboardList,
  Users,
} from 'lucide-react';
import CreateOrderModal from './components/CreateOrderModal';
import OrderDetails from './components/OrderDetails';
import MissionsPanel from './components/MissionsPanel';
import AffiliatesPanel from './components/AffiliatesPanel';
import { API_BASE } from './config';

const TYPE_LABELS = {
  pickup: 'Pick up',
  empty_box: 'Box',
};
const getTypeLabel = (type) => TYPE_LABELS[type] || (type === 'send' ? 'Pick up' : type);

const CREATED_BY_LABELS = {
  customer: 'Customer',
  customer_service: 'Customer service',
};

function useOrders(onNewOrders) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const knownIdsRef = { current: new Set() };

  const fetchOrders = async (isPoll = false) => {
    if (!isPoll) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/orders`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      if (isPoll && onNewOrders && knownIdsRef.current.size > 0) {
        const newOrders = data.filter((o) => !knownIdsRef.current.has(o.id));
        if (newOrders.length > 0) {
          onNewOrders(newOrders);
        }
      }
      knownIdsRef.current = new Set(data.map((o) => o.id));
      setOrders(data);
    } catch (e) {
      setError(e.message);
      setOrders([]);
    } finally {
      if (!isPoll) setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(() => fetchOrders(true), 5000);
    return () => clearInterval(interval);
  }, []);

  return { orders, loading, error, refetch: () => fetchOrders(false) };
}

function useStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/orders/stats`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setStats(d);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return { stats, loading };
}

export default function App() {
  const [activeTab, setActiveTab] = useState('orders');
  const [newOrderAlert, setNewOrderAlert] = useState(null);

  const handleNewOrders = (newOrders) => {
    const fromCustomer = newOrders.filter((o) => o.createdBy === 'customer');
    if (fromCustomer.length > 0) {
      setNewOrderAlert({
        count: fromCustomer.length,
        orders: fromCustomer,
      });
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('New order!', {
          body: `${fromCustomer.length} new orders from system`,
          icon: '/favicon.ico',
        });
      }
    }
  };

  const { orders, loading, error, refetch } = useOrders(handleNewOrders);
  const { stats, loading: statsLoading } = useStats();
  const [filterType, setFilterType] = useState('');
  const [filterCreatedBy, setFilterCreatedBy] = useState('');
  const [filterContacted, setFilterContacted] = useState('');
  const [filterMissions, setFilterMissions] = useState('');
  const [filterName, setFilterName] = useState('');
  const [filterPhone, setFilterPhone] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterBoxType, setFilterBoxType] = useState(''); // 'large' | 'small' | ''
  const [filterAffiliate, setFilterAffiliate] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [addMissionFor, setAddMissionFor] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateOrder, setShowCreateOrder] = useState(false);

  const activeFilterCount = [filterType, filterCreatedBy, filterContacted, filterMissions, filterName, filterPhone, filterDateFrom, filterDateTo, filterBoxType, filterAffiliate].filter(Boolean).length;

  const affiliateOptions = [...new Set(orders.map((o) => o.affiliateName).filter(Boolean))].sort();

  const filtered = orders.filter((o) => {
    if (filterType === 'pickup' && !['pickup', 'send'].includes(o.type)) return false;
    if (filterType === 'empty_box' && o.type !== 'empty_box') return false;
    if (filterCreatedBy && o.createdBy !== filterCreatedBy) return false;
    if (filterContacted === 'yes' && !o.contacted) return false;
    if (filterContacted === 'no' && o.contacted) return false;
    if (filterMissions === 'yes' && !(Array.isArray(o.missions) && o.missions.length > 0)) return false;
    if (filterMissions === 'no' && Array.isArray(o.missions) && o.missions.length > 0) return false;
    if (filterName) {
      const name = (o.fullName || [o.firstName, o.lastName].filter(Boolean).join(' ') || '').toLowerCase();
      if (!name.includes(filterName.toLowerCase())) return false;
    }
    if (filterPhone) {
      const ph = (o.customerPhone || '').replace(/\D/g, '');
      if (!ph.includes(filterPhone.replace(/\D/g, ''))) return false;
    }
    if (filterDateFrom && o.createdAt && new Date(o.createdAt) < new Date(filterDateFrom)) return false;
    if (filterDateTo && o.createdAt && new Date(o.createdAt) > new Date(filterDateTo + 'T23:59:59')) return false;
    if (filterBoxType === 'large' && !(o.boxSelection?.large > 0)) return false;
    if (filterBoxType === 'small' && !(o.boxSelection?.small > 0)) return false;
    if (filterAffiliate === '__none__' && o.affiliateName) return false;
    if (filterAffiliate && filterAffiliate !== '__none__' && o.affiliateName !== filterAffiliate) return false;
    return true;
  });

  const clearFilters = () => {
    setFilterType(''); setFilterCreatedBy(''); setFilterContacted('');
    setFilterMissions(''); setFilterName(''); setFilterPhone('');
    setFilterDateFrom(''); setFilterDateTo(''); setFilterBoxType(''); setFilterAffiliate('');
  };

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      {newOrderAlert && (
        <div className="sticky top-0 z-50 bg-amber-500 text-white px-4 py-3 flex items-center justify-between gap-4 shadow-lg">
          <span className="font-semibold">
            🔔 {newOrderAlert.count} new orders! (Status: Received)
          </span>
          <button
            onClick={() => setNewOrderAlert(null)}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg font-medium"
          >
            Close
          </button>
        </div>
      )}
      <header className="bg-slate-800 text-white px-4 py-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src="/isa-logo.png"
              alt="ISA Express"
              className="h-10 sm:h-12 w-auto object-contain brightness-0 invert"
            />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Manager ISA</h1>
              <p className="text-slate-300 text-sm">Order management - ISA Express</p>
            </div>
          </div>
          <div className="flex gap-2">
            {activeTab === 'orders' && (
              <>
                <button
                  onClick={() => setShowCreateOrder(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium"
                >
                  <Plus className="w-5 h-5" />
                  Create new order
                </button>
                <button
                  onClick={refetch}
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
            onClick={() => setActiveTab('orders')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'orders'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-600 hover:text-slate-800'
            }`}
          >
            <Package className="w-4 h-4" />
            Orders
          </button>
          <button
            onClick={() => setActiveTab('affiliates')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'affiliates'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-600 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            Affiliates
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* Affiliates tab */}
        {activeTab === 'affiliates' && <AffiliatesPanel orders={orders} />}

        {activeTab !== 'affiliates' && (
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
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                <div className="text-2xl font-bold text-slate-800">{stats.total}</div>
                <div className="text-sm text-slate-500">Total orders</div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                <div className="text-2xl font-bold text-green-600 flex items-center gap-1">
                  <PhoneCall className="w-5 h-5" />
                  {stats.contacted ?? 0}
                </div>
                <div className="text-sm text-slate-500">Contacted</div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                <div className="text-2xl font-bold text-amber-600 flex items-center gap-1">
                  <PhoneOff className="w-5 h-5" />
                  {stats.notContacted ?? 0}
                </div>
                <div className="text-sm text-slate-500">Not contacted</div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                <div className="text-2xl font-bold text-blue-600">{stats.totalBoxes || 0}</div>
                <div className="text-sm text-slate-500">Total boxes</div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                <div className="text-2xl font-bold text-emerald-600">₪{stats.totalPrice || 0}</div>
                <div className="text-sm text-slate-500">Total price</div>
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
                <X className="w-3.5 h-3.5" />Clear filters
              </button>
            )}
          </div>
          {showFilters && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Search by name</label>
                  <input
                    type="text"
                    value={filterName}
                    onChange={(e) => setFilterName(e.target.value)}
                    placeholder="Name..."
                    className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Search by phone</label>
                  <input
                    type="text"
                    value={filterPhone}
                    onChange={(e) => setFilterPhone(e.target.value)}
                    placeholder="050..."
                    className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Order type</label>
                  <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                    <option value="">All</option>
                    {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Source</label>
                  <select value={filterCreatedBy} onChange={(e) => setFilterCreatedBy(e.target.value)} className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                    <option value="">All</option>
                    {Object.entries(CREATED_BY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Contacted</label>
                  <select value={filterContacted} onChange={(e) => setFilterContacted(e.target.value)} className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                    <option value="">All</option>
                    <option value="yes">Contacted</option>
                    <option value="no">Not contacted</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Missions</label>
                  <select value={filterMissions} onChange={(e) => setFilterMissions(e.target.value)} className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                    <option value="">All</option>
                    <option value="yes">Has missions</option>
                    <option value="no">No missions</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Box type</label>
                  <select value={filterBoxType} onChange={(e) => setFilterBoxType(e.target.value)} className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                    <option value="">All</option>
                    <option value="large">ISA-BOX-70 (Large)</option>
                    <option value="small">ISA-BOX-35 (Small)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Affiliate</label>
                  <select value={filterAffiliate} onChange={(e) => setFilterAffiliate(e.target.value)} className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                    <option value="">All</option>
                    <option value="__none__">No affiliate</option>
                    {affiliateOptions.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">From date</label>
                  <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">To date</label>
                  <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Table */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <h2 className="text-lg font-semibold text-slate-800 p-4 border-b flex items-center gap-2">
            <Package className="w-5 h-5" />
            All orders ({filtered.length})
          </h2>

          {error || loading ? (
            <div className="p-8 text-center">
              {error ? (
                <p className="text-red-600">Error: {error}. For local run – ensure server is running (npm run server).</p>
              ) : (
                <p className="text-slate-500">Loading...</p>
              )}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No orders to display</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-4 py-3 text-sm font-semibold text-slate-600">ID</th>
                    <th className="px-4 py-3 text-sm font-semibold text-slate-600">Contacted</th>
                    <th className="px-4 py-3 text-sm font-semibold text-slate-600">Boxes</th>
                    <th className="px-4 py-3 text-sm font-semibold text-slate-600">Source</th>
                    <th className="px-4 py-3 text-sm font-semibold text-slate-600">Affiliate</th>
                    <th className="px-4 py-3 text-sm font-semibold text-slate-600">Phone</th>
                    <th className="px-4 py-3 text-sm font-semibold text-slate-600">Name</th>
                    <th className="px-4 py-3 text-sm font-semibold text-slate-600">Date</th>
                    <th className="px-4 py-3 text-sm font-semibold text-slate-600">Edit</th>
                    <th className="px-4 py-3 text-sm font-semibold text-slate-600">Missions</th>
                    <th className="px-4 py-3 text-sm font-semibold text-slate-600">Add</th>
                    <th className="px-4 py-3 text-sm font-semibold text-slate-600"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((order) => (
                    <>
                      <tr
                        key={order.id}
                        className="border-b border-slate-100 hover:bg-slate-50/50 cursor-pointer"
                        onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
                      >
                        <td className="px-4 py-3 font-mono font-bold text-blue-600">{order.id}</td>
                        <td className="px-4 py-3">
                          {order.contacted ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex items-center gap-1 w-fit">
                              <PhoneCall className="w-3.5 h-3.5" />
                              Contacted
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1 w-fit">
                              <PhoneOff className="w-3.5 h-3.5" />
                              Not contacted
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {order.boxSelection ? (
                            <div className="text-xs space-y-0.5">
                              {order.boxSelection.large > 0 && (
                                <div className="flex items-center gap-1 text-blue-700">
                                  <span className="font-mono bg-blue-100 px-1 rounded">BOX-70</span>
                                  <span className="font-bold">×{order.boxSelection.large}</span>
                                </div>
                              )}
                              {order.boxSelection.small > 0 && (
                                <div className="flex items-center gap-1 text-indigo-700">
                                  <span className="font-mono bg-indigo-100 px-1 rounded">BOX-35</span>
                                  <span className="font-bold">×{order.boxSelection.small}</span>
                                </div>
                              )}
                              {!order.boxSelection.large && !order.boxSelection.small && <span className="text-slate-400">—</span>}
                            </div>
                          ) : (
                            <span className="text-sm text-slate-600">{order.boxes || '—'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {CREATED_BY_LABELS[order.createdBy] || order.createdBy}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {order.affiliateName ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-medium">
                              <Users className="w-3 h-3" />
                              {order.affiliateName}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">{order.customerPhone || '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {order.fullName || [order.firstName, order.lastName].filter(Boolean).join(' ') || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {order.createdAt
                            ? new Date(order.createdAt).toLocaleDateString('en-US', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingOrder(order); }}
                            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
                            title="Edit order"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          {Array.isArray(order.missions) && order.missions.length > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
                              <ClipboardList className="w-3 h-3" />
                              {order.missions.length}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedId(order.id);
                              setAddMissionFor(order.id);
                            }}
                            className="p-1.5 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-600 hover:text-indigo-800 transition-colors"
                            title="Add mission"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          {expandedId === order.id ? (
                            <ChevronUp className="w-5 h-5 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-slate-400" />
                          )}
                        </td>
                      </tr>
                      {expandedId === order.id && (
                        <tr key={`${order.id}-exp`} className="bg-slate-50/80">
                          <td colSpan={13} className="px-0 py-0 align-top">
                            <div className="border-t border-indigo-100 bg-indigo-50/40">
                              <MissionsPanel
                                order={order}
                                onUpdated={() => refetch()}
                                openForm={addMissionFor === order.id}
                                onFormOpened={() => setAddMissionFor(null)}
                              />
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        </>
        )}
      </main>

      {/* Order edit modal */}
      {editingOrder && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto"
          onClick={() => setEditingOrder(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-bold text-slate-800 text-lg">Edit Order — {editingOrder.id}</h2>
              <button onClick={() => setEditingOrder(null)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="px-6 py-4">
              <OrderDetails
                order={editingOrder}
                onSave={() => { refetch(); setEditingOrder(null); }}
                onClose={() => setEditingOrder(null)}
                onDelete={() => { refetch(); setEditingOrder(null); setExpandedId(null); }}
              />
            </div>
          </div>
        </div>
      )}

      <CreateOrderModal
        isOpen={showCreateOrder}
        onClose={() => setShowCreateOrder(false)}
        onCreated={() => { refetch(); setShowCreateOrder(false); }}
      />
    </div>
  );
}
