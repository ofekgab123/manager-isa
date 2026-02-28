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
  Truck,
} from 'lucide-react';
import CreateOrderModal from './components/CreateOrderModal';
import OrderDetails from './components/OrderDetails';

const API_BASE = '/api';

const STATUS_LABELS = {
  pending: 'ממתין',
  recorded: 'נרשם במוקד',
  received: 'התקבל במערכת',
  boxes_requested: 'נדרשו ארגזים',
  linewhel_scheduled: 'Linewhel נקבע',
  linewhel_transferred: 'הועבר ל-Linewhel',
  packed: 'ארוז',
  ready_pickup: 'מוכן לאיסוף',
  shipped: 'נשלח',
};

const TYPE_LABELS = {
  send: 'שליחה',
  pickup: 'איסוף',
  empty_box: 'ארגז ריק',
};

const CREATED_BY_LABELS = {
  customer: 'לקוח',
  customer_service: 'שירות לקוחות',
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
  const [newOrderAlert, setNewOrderAlert] = useState(null);

  const handleNewOrders = (newOrders) => {
    const fromCustomer = newOrders.filter((o) => o.createdBy === 'customer');
    if (fromCustomer.length > 0) {
      setNewOrderAlert({
        count: fromCustomer.length,
        orders: fromCustomer,
      });
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('הזמנה חדשה!', {
          body: `נכנסו ${fromCustomer.length} הזמנות חדשות ממערכת`,
          icon: '/favicon.ico',
        });
      }
    }
  };

  const { orders, loading, error, refetch } = useOrders(handleNewOrders);
  const { stats, loading: statsLoading } = useStats();
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterCreatedBy, setFilterCreatedBy] = useState('');
  const [filterContacted, setFilterContacted] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [transferringId, setTransferringId] = useState(null);

  const handleTransferToLinewhel = async (orderId) => {
    setTransferringId(orderId);
    try {
      const res = await fetch(`${API_BASE}/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'linewhel_transferred' }),
      });
      if (res.ok) refetch();
    } finally {
      setTransferringId(null);
    }
  };

  const filtered = orders.filter((o) => {
    if (filterStatus && o.status !== filterStatus) return false;
    if (filterType && o.type !== filterType) return false;
    if (filterCreatedBy && o.createdBy !== filterCreatedBy) return false;
    if (filterContacted === 'yes' && !o.contacted) return false;
    if (filterContacted === 'no' && o.contacted) return false;
    return true;
  });

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
            🔔 נכנסו {newOrderAlert.count} הזמנות חדשות! (סטטוס: התקבל במערכת)
          </span>
          <button
            onClick={() => setNewOrderAlert(null)}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg font-medium"
          >
            סגור
          </button>
        </div>
      )}
      <header className="bg-slate-800 text-white px-4 py-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Manager ISA</h1>
            <p className="text-slate-300 text-sm">ניהול הזמנות - ISA Express</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreateOrder(true)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium"
            >
              <Plus className="w-5 h-5" />
              צור הזמנה חדשה
            </button>
            <button
              onClick={refetch}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg font-medium disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              רענן
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* סטטיסטיקות */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            פילוחים וסטטיסטיקות
          </h2>
          {statsLoading ? (
            <div className="text-slate-500">טוען...</div>
          ) : stats ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                <div className="text-2xl font-bold text-slate-800">{stats.total}</div>
                <div className="text-sm text-slate-500">סה״כ הזמנות</div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                <div className="text-2xl font-bold text-green-600 flex items-center gap-1">
                  <PhoneCall className="w-5 h-5" />
                  {stats.contacted ?? 0}
                </div>
                <div className="text-sm text-slate-500">התקשרו</div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                <div className="text-2xl font-bold text-amber-600 flex items-center gap-1">
                  <PhoneOff className="w-5 h-5" />
                  {stats.notContacted ?? 0}
                </div>
                <div className="text-sm text-slate-500">לא התקשרו</div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                <div className="text-2xl font-bold text-blue-600">{stats.totalBoxes || 0}</div>
                <div className="text-sm text-slate-500">סה״כ ארגזים</div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                <div className="text-2xl font-bold text-emerald-600">₪{stats.totalPrice || 0}</div>
                <div className="text-sm text-slate-500">סה״כ מחיר</div>
              </div>
              {Object.entries(stats.byStatus || {}).map(([status, count]) => (
                <div key={status} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                  <div className="text-xl font-bold text-slate-700">{count}</div>
                  <div className="text-xs text-slate-500">{STATUS_LABELS[status] || status}</div>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        {/* פילטרים */}
        <div className="mb-4 flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <Filter className="w-4 h-4" />
            פילטרים
            {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showFilters && (
            <div className="flex flex-wrap gap-2">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm"
              >
                <option value="">כל הסטטוסים</option>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm"
              >
                <option value="">כל הסוגים</option>
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <select
                value={filterCreatedBy}
                onChange={(e) => setFilterCreatedBy(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm"
              >
                <option value="">כל המקורות</option>
                {Object.entries(CREATED_BY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <select
                value={filterContacted}
                onChange={(e) => setFilterContacted(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm"
              >
                <option value="">כל ההתקשרויות</option>
                <option value="yes">התקשרו</option>
                <option value="no">לא התקשרו</option>
              </select>
            </div>
          )}
        </div>

        {/* טבלה */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <h2 className="text-lg font-semibold text-slate-800 p-4 border-b flex items-center gap-2">
            <Package className="w-5 h-5" />
            כל ההזמנות ({filtered.length})
          </h2>

          {error || loading ? (
            <div className="p-8 text-center">
              {error ? (
                <p className="text-red-600">שגיאה: {error}. ודא שהשרת רץ על פורט 3002.</p>
              ) : (
                <p className="text-slate-500">טוען...</p>
              )}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-500">אין הזמנות להצגה</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-4 py-3 text-sm font-semibold text-slate-600">מזהה</th>
                    <th className="px-4 py-3 text-sm font-semibold text-slate-600">סוג</th>
                    <th className="px-4 py-3 text-sm font-semibold text-slate-600">סטטוס</th>
                    <th className="px-4 py-3 text-sm font-semibold text-slate-600">התקשרו</th>
                    <th className="px-4 py-3 text-sm font-semibold text-slate-600">ארגזים</th>
                    <th className="px-4 py-3 text-sm font-semibold text-slate-600">מקור</th>
                    <th className="px-4 py-3 text-sm font-semibold text-slate-600">טלפון</th>
                    <th className="px-4 py-3 text-sm font-semibold text-slate-600">תאריך</th>
                    <th className="px-4 py-3 text-sm font-semibold text-slate-600">פרטים</th>
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
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100">
                            {TYPE_LABELS[order.type] || order.type}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100">
                            {STATUS_LABELS[order.status] || order.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {order.contacted ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex items-center gap-1 w-fit">
                              <PhoneCall className="w-3.5 h-3.5" />
                              התקשרו
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1 w-fit">
                              <PhoneOff className="w-3.5 h-3.5" />
                              לא התקשרו
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">{order.boxes}</td>
                        <td className="px-4 py-3 text-sm">
                          {CREATED_BY_LABELS[order.createdBy] || order.createdBy}
                        </td>
                        <td className="px-4 py-3 text-sm">{order.customerPhone || '-'}</td>
                        <td className="px-4 py-3 text-sm">
                          {order.createdAt
                            ? new Date(order.createdAt).toLocaleDateString('he-IL', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '-'}
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
                          <td colSpan={9} className="px-4 py-4 align-top">
                            <OrderDetails
                              order={order}
                              onSave={(updated) => {
                                refetch();
                              }}
                              onClose={() => setExpandedId(null)}
                            />
                              {order.createdBy === 'customer' &&
                                !['linewhel_transferred', 'linewhel_scheduled', 'shipped'].includes(order.status) && (
                                <div className="mt-4 pt-4 border-t">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleTransferToLinewhel(order.id);
                                    }}
                                    disabled={transferringId === order.id}
                                    className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                                  >
                                    <Truck className="w-4 h-4" />
                                    {transferringId === order.id ? 'מעביר...' : 'העבר ל-Linewhel'}
                                  </button>
                                </div>
                              )}
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
      </main>

      <CreateOrderModal
        isOpen={showCreateOrder}
        onClose={() => setShowCreateOrder(false)}
        onCreated={() => { refetch(); setShowCreateOrder(false); }}
      />
    </div>
  );
}
