import React, { useEffect, useState } from 'react';
import { 
  BarChart3, MessageSquare, ShoppingBag, Users, TrendingUp,
  Calendar, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { api } from '../utils/api';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import AnalyticsCard from '../components/AnalyticsCard';

const COLORS = ['#D4AF37', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899'];

function Analytics() {
  const [period, setPeriod] = useState('week');
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  async function loadAnalytics() {
    try {
      setLoading(true);
      const [statsRes, analyticsRes] = await Promise.all([
        api.get(`/api/stats?period=${period}`),
        api.get(`/api/analytics?type=overview&days=${period === 'week' ? 7 : period === 'month' ? 30 : 1}`)
      ]);
      
      setStats(statsRes.data);
      setChartData(analyticsRes.data);
    } catch (error) {
      console.error('Load analytics error:', error);
    } finally {
      setLoading(false);
    }
  }

  const periods = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' }
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-kaapav-text">Analytics</h1>
          <p className="text-kaapav-muted">Track your performance</p>
        </div>
        
        <div className="flex gap-2">
          {periods.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-4 py-2 rounded-lg ${
                period === p.value 
                  ? 'bg-gold-400 text-white' 
                  : 'bg-white border border-kaapav-border hover:border-gold-400'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <AnalyticsCard
          title="Total Messages"
          value={stats?.messages?.total || 0}
          subtext={`${stats?.messages?.incoming || 0} in · ${stats?.messages?.outgoing || 0} out`}
          icon={MessageSquare}
          color="bg-blue-500"
          trend="+12%"
          trendUp={true}
        />
        <AnalyticsCard
          title="Orders"
          value={stats?.orders?.total || 0}
          subtext={`₹${stats?.orders?.revenue || 0} revenue`}
          icon={ShoppingBag}
          color="bg-green-500"
          trend="+8%"
          trendUp={true}
        />
        <AnalyticsCard
          title="Active Chats"
          value={stats?.chats?.open || 0}
          subtext={`${stats?.chats?.unread || 0} unread`}
          icon={Users}
          color="bg-purple-500"
        />
        <AnalyticsCard
          title="Conversion Rate"
          value={`${stats?.orders?.total && stats?.chats?.total 
            ? ((stats.orders.total / stats.chats.total) * 100).toFixed(1) 
            : 0}%`}
          subtext="Messages to orders"
          icon={TrendingUp}
          color="bg-gold-500"
          trend="+5%"
          trendUp={true}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Messages Chart */}
        <div className="card">
          <h3 className="font-semibold mb-4">Messages Over Time</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData?.messagesByDay || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#6B7280" />
                <YAxis tick={{ fontSize: 12 }} stroke="#6B7280" />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="incoming" 
                  stroke="#3B82F6" 
                  strokeWidth={2}
                  dot={false}
                  name="Incoming"
                />
                <Line 
                  type="monotone" 
                  dataKey="outgoing" 
                  stroke="#D4AF37" 
                  strokeWidth={2}
                  dot={false}
                  name="Outgoing"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Orders Chart */}
        <div className="card">
          <h3 className="font-semibold mb-4">Orders & Revenue</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData?.ordersByDay || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#6B7280" />
                <YAxis tick={{ fontSize: 12 }} stroke="#6B7280" />
                <Tooltip />
                <Bar dataKey="total" fill="#D4AF37" radius={[4, 4, 0, 0]} name="Orders" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Hours */}
        <div className="card">
          <h3 className="font-semibold mb-4">Peak Hours</h3>
          <div className="space-y-2">
            {(chartData?.messagesByHour || []).slice(0, 5).map((hour, i) => (
              <div key={hour.hour} className="flex items-center justify-between">
                <span className="text-sm text-kaapav-muted">
                  {hour.hour}:00 - {hour.hour}:59
                </span>
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gold-400 h-2 rounded-full" 
                      style={{ width: `${(hour.count / (chartData?.messagesByHour?.[0]?.count || 1)) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-12 text-right">{hour.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Order Status Distribution */}
        <div className="card">
          <h3 className="font-semibold mb-4">Order Status</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Delivered', value: stats?.orders?.delivered || 0 },
                    { name: 'Shipped', value: stats?.orders?.shipped || 0 },
                    { name: 'Confirmed', value: stats?.orders?.confirmed || 0 },
                    { name: 'Pending', value: stats?.orders?.pending || 0 },
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {COLORS.map((color, index) => (
                    <Cell key={`cell-${index}`} fill={color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="card">
          <h3 className="font-semibold mb-4">Quick Stats</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-kaapav-muted">Avg Response Time</span>
              <span className="font-medium">~5 min</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-kaapav-muted">Auto-reply Rate</span>
              <span className="font-medium">{stats?.messages?.auto_replies || 0}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-kaapav-muted">Avg Order Value</span>
              <span className="font-medium">
                ₹{stats?.orders?.total && stats?.orders?.revenue 
                  ? Math.round(stats.orders.revenue / stats.orders.total) 
                  : 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-kaapav-muted">Customer Satisfaction</span>
              <span className="font-medium text-green-500">98%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Analytics;