import { useState, useMemo, useEffect } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, LineChart, Line, CartesianGrid, Legend,
} from 'recharts';
import {
  TrendingUp, Package, Truck, Users, Tag, Filter, X, AlertTriangle,
  BarChart2, Calendar, RefreshCw, Activity,
} from 'lucide-react';
import { API_BASE } from '../config';
import { isAffiliatePickupCompletedInLionWheel } from '../lionwheelStatus';

const STATUS_LABELS = {
  received: 'Received',
  linewhel_transferred: 'Transferred',
  linewhel_scheduled: 'Scheduled',
  collected: 'Collected',
  shipped: 'Shipped',
  completed: 'Completed',
};

const STATUS_COLORS = {
  received: '#3b82f6',
  linewhel_transferred: '#f59e0b',
  linewhel_scheduled: '#a855f7',
  collected: '#06b6d4',
  shipped: '#6366f1',
  completed: '#22c55e',
};

const TYPE_LABELS = { pickup: 'Pickup', empty_box: 'Empty Box' };
const TYPE_COLORS = { pickup: '#6366f1', empty_box: '#3b82f6' };

const CREATOR_LABELS = { customer: 'Customer', customer_service: 'CS' };
const CREATOR_COLORS = { customer: '#f59e0b', customer_service: '#22c55e' };

function KpiCard({ value, label, color = 'text-slate-800', icon, accent }) {
  return (
    <div className={`stat-card border-l-4 ${accent || 'border-slate-200'}`}>
      <div className={`text-3xl font-extrabold ${color} flex items-center gap-1.5`}>
        {icon}
        {value}
      </div>
      <div className="text-sm text-slate-500 mt-1">{label}</div>
    </div>
  );
}

function ChartCard({ title, icon, children, className = '', subtitle }) {
  return (
    <div className={`card-elevated p-6 ${className}`}>
      <div className="mb-4">
        <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
          {icon}
          {title}
        </h3>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5 ml-6">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { name, value, payload: p } = payload[0];
  const pct = p.total > 0 ? Math.round((value / p.total) * 100) : 0;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-sm">
      <div className="font-semibold text-slate-700">{name}</div>
      <div className="text-slate-800">
        <span className="font-bold">{value}</span>
        <span className="text-slate-400 ml-1">({pct}%)</span>
      </div>
    </div>
  );
};

const BarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-sm">
      {label && <div className="font-medium text-slate-600 mb-1">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span className="text-slate-600">{p.name}:</span>
          <span className="font-bold text-slate-800">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-36 text-slate-300">
      <BarChart2 className="w-8 h-8 mb-2" />
      <span className="text-sm">No data for this filter</span>
    </div>
  );
}

function ProgressBar({ label, count, pct, color }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1.5">
        <span className="flex items-center gap-2 font-medium text-slate-700">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
          {label}
        </span>
        <span className="font-bold text-slate-800">
          {count}
          <span className="font-normal text-slate-400 ml-1">({pct.toFixed(1)}%)</span>
        </span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
        <div
          className="h-2 rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

export default function StatisticsPanel({ missions = [], affiliates = [], onRefresh, loading }) {
  const [userCount, setUserCount] = useState(0);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCreatedBy, setFilterCreatedBy] = useState('');
  const [filterAffiliate, setFilterAffiliate] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/users`)
      .then((r) => r.json())
      .then((data) => setUserCount(Array.isArray(data) ? data.length : 0))
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    return missions.filter((m) => {
      if (filterType && m.type !== filterType) return false;
      if (filterStatus && m.status !== filterStatus) return false;
      if (filterCreatedBy && m.createdBy !== filterCreatedBy) return false;
      if (filterAffiliate && (m.affiliateName !== filterAffiliate || m.type !== 'pickup')) return false;
      if (filterDateFrom && m.createdAt && new Date(m.createdAt) < new Date(filterDateFrom))
        return false;
      if (
        filterDateTo &&
        m.createdAt &&
        new Date(m.createdAt) > new Date(filterDateTo + 'T23:59:59')
      )
        return false;
      return true;
    });
  }, [missions, filterType, filterStatus, filterCreatedBy, filterAffiliate, filterDateFrom, filterDateTo]);

  const byStatus = useMemo(() => {
    const counts = {};
    filtered.forEach((m) => {
      counts[m.status] = (counts[m.status] || 0) + 1;
    });
    return Object.entries(STATUS_LABELS)
      .map(([k, name]) => ({ name, value: counts[k] || 0, key: k, total: filtered.length }))
      .filter((d) => d.value > 0);
  }, [filtered]);

  const byType = useMemo(() => {
    const counts = {};
    filtered.forEach((m) => {
      counts[m.type] = (counts[m.type] || 0) + 1;
    });
    return Object.entries(counts).map(([k, v]) => ({
      name: TYPE_LABELS[k] || k,
      value: v,
      key: k,
      total: filtered.length,
    }));
  }, [filtered]);

  const byCreator = useMemo(() => {
    const counts = {};
    filtered.forEach((m) => {
      counts[m.createdBy] = (counts[m.createdBy] || 0) + 1;
    });
    return Object.entries(counts).map(([k, v]) => ({
      name: CREATOR_LABELS[k] || k,
      value: v,
      key: k,
      total: filtered.length,
    }));
  }, [filtered]);

  const boxData = useMemo(() => {
    let large = 0,
      small = 0;
    filtered.forEach((m) => {
      large += m.boxSelection?.large || 0;
      small += m.boxSelection?.small || 0;
    });
    const total = large + small;
    return [
      { name: 'ISA-BOX-70 (Large)', value: large, key: 'large', total },
      { name: 'ISA-BOX-35 (Small)', value: small, key: 'small', total },
    ].filter((d) => d.value > 0);
  }, [filtered]);

  const totalBoxes = useMemo(() => {
    return filtered.reduce(
      (s, m) => s + (m.boxSelection?.large || 0) + (m.boxSelection?.small || 0),
      0,
    );
  }, [filtered]);

  const byAffiliate = useMemo(() => {
    const counts = {};
    filtered.forEach((m) => {
      if (isAffiliatePickupCompletedInLionWheel(m)) counts[m.affiliateName] = (counts[m.affiliateName] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([k, v]) => ({ name: k, missions: v }))
      .sort((a, b) => b.missions - a.missions)
      .slice(0, 10);
  }, [filtered]);

  const overTime = useMemo(() => {
    const now = new Date();
    const fromDate = filterDateFrom ? new Date(filterDateFrom) : new Date(now.getTime() - 29 * 86400000);
    const toDate = filterDateTo ? new Date(filterDateTo + 'T23:59:59') : now;
    const days = {};
    const d = new Date(fromDate);
    while (d <= toDate) {
      days[d.toISOString().slice(0, 10)] = 0;
      d.setDate(d.getDate() + 1);
    }
    filtered.forEach((m) => {
      if (m.createdAt) {
        const key = new Date(m.createdAt).toISOString().slice(0, 10);
        if (key in days) days[key]++;
      }
    });
    return Object.entries(days).map(([date, count]) => ({
      date: date.slice(5).replace('-', '/'),
      count,
    }));
  }, [filtered, filterDateFrom, filterDateTo]);

  const missingAddressCount = useMemo(
    () =>
      filtered.filter((m) =>
        m.type === 'pickup' ? !m.receiverAddress?.lat : !m.address?.lat,
      ).length,
    [filtered],
  );

  const affiliateOrderCount = useMemo(
    () => filtered.filter(isAffiliatePickupCompletedInLionWheel).length,
    [filtered],
  );

  const completedCount = useMemo(
    () => filtered.filter((m) => m.status === 'completed').length,
    [filtered],
  );

  const completionRate = filtered.length > 0 ? ((completedCount / filtered.length) * 100).toFixed(1) : 0;

  const activeFiltersCount = [
    filterType, filterStatus, filterCreatedBy, filterAffiliate, filterDateFrom, filterDateTo,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setFilterType('');
    setFilterStatus('');
    setFilterCreatedBy('');
    setFilterAffiliate('');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  const timeChartSubtitle =
    filterDateFrom || filterDateTo ? 'Selected date range' : 'Last 30 days';

  const hasTimeData = overTime.some((d) => d.count > 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Filters */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-bold text-slate-700">Filters</span>
          {activeFiltersCount > 0 && (
            <span className="text-xs bg-indigo-600 text-white rounded-full px-2 py-0.5 font-bold">
              {activeFiltersCount}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {activeFiltersCount > 0 && (
              <button
                onClick={clearFilters}
                className="btn-secondary !py-1.5 !px-3 !text-xs"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            )}
            <button
              onClick={onRefresh}
              disabled={loading}
              className="btn-secondary !py-1.5 !px-3 !text-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="label">From date</label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="label">To date</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="label">Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="select-field"
            >
              <option value="">All types</option>
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="select-field"
            >
              <option value="">All statuses</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Source</label>
            <select
              value={filterCreatedBy}
              onChange={(e) => setFilterCreatedBy(e.target.value)}
              className="select-field"
            >
              <option value="">All sources</option>
              {Object.entries(CREATOR_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Affiliate</label>
            <select
              value={filterAffiliate}
              onChange={(e) => setFilterAffiliate(e.target.value)}
              className="select-field"
            >
              <option value="">All affiliates</option>
              {affiliates.map((a) => (
                <option key={a.id} value={a.name}>{a.name}</option>
              ))}
            </select>
          </div>
        </div>
        {activeFiltersCount > 0 && (
          <p className="text-xs text-indigo-600 mt-3 font-semibold">
            Showing {filtered.length} of {missions.length} missions
          </p>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <KpiCard
          value={filtered.length}
          label="Total missions"
          color="text-slate-800"
          accent="border-slate-300"
        />
        <KpiCard
          value={byType.find((t) => t.key === 'pickup')?.value || 0}
          label="Pickups"
          color="text-indigo-600"
          icon={<Truck className="w-5 h-5" />}
          accent="border-indigo-500"
        />
        <KpiCard
          value={byType.find((t) => t.key === 'empty_box')?.value || 0}
          label="Empty Boxes"
          color="text-blue-600"
          icon={<Package className="w-5 h-5" />}
          accent="border-blue-500"
        />
        <KpiCard
          value={totalBoxes}
          label="Total boxes"
          color="text-cyan-600"
          accent="border-cyan-500"
        />
        <KpiCard
          value={`${completionRate}%`}
          label="Completion rate"
          color="text-green-600"
          accent="border-green-500"
        />
        <KpiCard
          value={affiliateOrderCount}
          label="Affiliate orders"
          color="text-purple-600"
          icon={<Tag className="w-5 h-5" />}
          accent="border-purple-500"
        />
        <KpiCard
          value={missingAddressCount}
          label="Missing address"
          color={missingAddressCount > 0 ? 'text-amber-600' : 'text-slate-400'}
          icon={missingAddressCount > 0 ? <AlertTriangle className="w-5 h-5" /> : null}
          accent={missingAddressCount > 0 ? 'border-amber-500' : 'border-slate-200'}
        />
        <KpiCard
          value={userCount}
          label="Registered users"
          color="text-teal-600"
          icon={<Users className="w-5 h-5" />}
          accent="border-teal-500"
        />
      </div>

      {/* Row 1: 3 Pie charts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Status pie */}
        <ChartCard
          title="By Status"
          icon={<Activity className="w-4 h-4 text-indigo-500" />}
        >
          {byStatus.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={byStatus}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    strokeWidth={2}
                    stroke="#fff"
                  >
                    {byStatus.map((entry) => (
                      <Cell
                        key={entry.key}
                        fill={STATUS_COLORS[entry.key] || '#94a3b8'}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-1">
                {byStatus.map((d) => (
                  <span key={d.key} className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: STATUS_COLORS[d.key] || '#94a3b8' }}
                    />
                    {d.name}
                    <strong>{d.value}</strong>
                    <span className="text-slate-400">
                      ({filtered.length > 0 ? Math.round((d.value / filtered.length) * 100) : 0}%)
                    </span>
                  </span>
                ))}
              </div>
            </>
          )}
        </ChartCard>

        {/* Type donut */}
        <ChartCard
          title="By Type"
          icon={<Package className="w-4 h-4 text-blue-500" />}
        >
          {byType.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={byType}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={80}
                    dataKey="value"
                    strokeWidth={2}
                    stroke="#fff"
                    label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                      const RADIAN = Math.PI / 180;
                      const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                      const x = cx + radius * Math.cos(-midAngle * RADIAN);
                      const y = cy + radius * Math.sin(-midAngle * RADIAN);
                      return percent > 0.05 ? (
                        <text
                          x={x}
                          y={y}
                          fill="#fff"
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={13}
                          fontWeight="bold"
                        >
                          {`${(percent * 100).toFixed(0)}%`}
                        </text>
                      ) : null;
                    }}
                    labelLine={false}
                  >
                    {byType.map((entry) => (
                      <Cell key={entry.key} fill={TYPE_COLORS[entry.key] || '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 mt-1 justify-center">
                {byType.map((d) => (
                  <div key={d.key} className="flex items-center gap-1.5 text-sm">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ background: TYPE_COLORS[d.key] || '#94a3b8' }}
                    />
                    <span className="text-slate-600">{d.name}</span>
                    <strong className="text-slate-800">{d.value}</strong>
                  </div>
                ))}
              </div>
            </>
          )}
        </ChartCard>

        {/* Creator donut */}
        <ChartCard
          title="By Source"
          icon={<Users className="w-4 h-4 text-green-500" />}
        >
          {byCreator.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={byCreator}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={80}
                    dataKey="value"
                    strokeWidth={2}
                    stroke="#fff"
                    label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                      const RADIAN = Math.PI / 180;
                      const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                      const x = cx + radius * Math.cos(-midAngle * RADIAN);
                      const y = cy + radius * Math.sin(-midAngle * RADIAN);
                      return percent > 0.05 ? (
                        <text
                          x={x}
                          y={y}
                          fill="#fff"
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={13}
                          fontWeight="bold"
                        >
                          {`${(percent * 100).toFixed(0)}%`}
                        </text>
                      ) : null;
                    }}
                    labelLine={false}
                  >
                    {byCreator.map((entry) => (
                      <Cell
                        key={entry.key}
                        fill={CREATOR_COLORS[entry.key] || '#94a3b8'}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 mt-1 justify-center">
                {byCreator.map((d) => (
                  <div key={d.key} className="flex items-center gap-1.5 text-sm">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ background: CREATOR_COLORS[d.key] || '#94a3b8' }}
                    />
                    <span className="text-slate-600">{d.name}</span>
                    <strong className="text-slate-800">{d.value}</strong>
                  </div>
                ))}
              </div>
            </>
          )}
        </ChartCard>
      </div>

      {/* Missions over time - full width */}
      <ChartCard
        title="Missions Over Time"
        icon={<Calendar className="w-4 h-4 text-indigo-500" />}
        subtitle={timeChartSubtitle}
        className="w-full"
      >
        {!hasTimeData ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={overTime}
              margin={{ top: 4, right: 10, left: -25, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
                interval={overTime.length > 14 ? Math.floor(overTime.length / 10) : 0}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<BarTooltip />} cursor={{ fill: '#f1f5f9' }} />
              <Bar dataKey="count" name="Missions" fill="#6366f1" radius={[3, 3, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Row: Affiliates bar + Box types donut */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Affiliates */}
        <ChartCard
          title="Top Affiliates by Missions"
          icon={<Tag className="w-4 h-4 text-purple-500" />}
        >
          {byAffiliate.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, byAffiliate.length * 32 + 20)}>
              <BarChart
                data={byAffiliate}
                layout="vertical"
                margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                  width={90}
                />
                <Tooltip content={<BarTooltip />} cursor={{ fill: '#f5f3ff' }} />
                <Bar dataKey="missions" name="Missions" fill="#a855f7" radius={[0, 3, 3, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Box types */}
        <ChartCard
          title="Box Types Distribution"
          icon={<Package className="w-4 h-4 text-blue-500" />}
        >
          {boxData.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="flex items-center gap-6">
              <div className="flex-1 min-w-0">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={boxData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      dataKey="value"
                      strokeWidth={2}
                      stroke="#fff"
                      label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                        const RADIAN = Math.PI / 180;
                        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                        const x = cx + radius * Math.cos(-midAngle * RADIAN);
                        const y = cy + radius * Math.sin(-midAngle * RADIAN);
                        return percent > 0.05 ? (
                          <text
                            x={x}
                            y={y}
                            fill="#fff"
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize={13}
                            fontWeight="bold"
                          >
                            {`${(percent * 100).toFixed(0)}%`}
                          </text>
                        ) : null;
                      }}
                      labelLine={false}
                    >
                      {boxData.map((entry, i) => (
                        <Cell key={entry.key} fill={['#3b82f6', '#6366f1'][i % 2]} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-4 shrink-0">
                {boxData.map((d, i) => (
                  <div key={d.key}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ background: ['#3b82f6', '#6366f1'][i % 2] }}
                      />
                      <span className="text-xs font-medium text-slate-600">{d.name}</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-800 pl-5">{d.value}</div>
                    <div className="text-xs text-slate-400 pl-5">
                      {d.total > 0 ? Math.round((d.value / d.total) * 100) : 0}% of total
                    </div>
                  </div>
                ))}
                <div className="pt-3 border-t border-slate-100 pl-5">
                  <div className="text-xs text-slate-400">Total boxes</div>
                  <div className="text-2xl font-bold text-slate-800">{totalBoxes}</div>
                </div>
              </div>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Status progress breakdown */}
      <ChartCard
        title="Status Breakdown"
        icon={<TrendingUp className="w-4 h-4 text-indigo-500" />}
        subtitle={`${filtered.length} total missions`}
      >
        {filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-4">
            {Object.entries(STATUS_LABELS).map(([key, label]) => {
              const count = filtered.filter((m) => m.status === key).length;
              if (count === 0) return null;
              const pct = (count / filtered.length) * 100;
              return (
                <ProgressBar
                  key={key}
                  label={label}
                  count={count}
                  pct={pct}
                  color={STATUS_COLORS[key]}
                />
              );
            })}
          </div>
        )}
      </ChartCard>
    </div>
  );
}
