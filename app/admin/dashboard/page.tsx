'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Users,
  Truck,
  Bell,
  Wallet,
  TrendingUp,
  Home,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
} from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface StatsData {
  totalUsers: number
  citizens: number
  workers: number
  admins: number
  pendingSignals: number
  totalHouseholds: number
  wasteReadyCount: number
  collectedCount: number
  revenueEstimate: number
  wasteTypeBreakdown: Record<string, number>
  weeklyTrend: { day: string; actual: number; predicted: number }[]
  recentActivity: { id: string; action_type: string; created_at: string; new_value: Record<string, unknown> }[]
}

const WASTE_COLORS: Record<string, string> = {
  wet: '#10b981',
  dry: '#f59e0b',
  hazardous: '#ef4444',
  recyclable: '#3b82f6',
  'e-waste': '#8b5cf6',
}

interface KpiCardProps {
  title: string
  value: string | number
  sub: string
  icon: React.ElementType
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  accent?: string
}

function KpiCard({ title, value, sub, icon: Icon, trend, trendValue, accent = 'text-emerald-500' }: KpiCardProps) {
  return (
    <Card className="bg-white border border-zinc-200 shadow-none">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-1">{title}</p>
            <p className="text-2xl font-bold text-zinc-900 tabular-nums">{value}</p>
            <p className="text-xs text-zinc-400 mt-1">{sub}</p>
          </div>
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center bg-zinc-50 border border-zinc-100')}>
            <Icon className={cn('w-5 h-5', accent)} />
          </div>
        </div>
        {trend && trendValue && (
          <div className="mt-3 flex items-center gap-1">
            {trend === 'up' ? (
              <ArrowUpRight className="w-3 h-3 text-emerald-500" />
            ) : trend === 'down' ? (
              <ArrowDownRight className="w-3 h-3 text-rose-500" />
            ) : null}
            <span className={cn('text-xs', trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-rose-500' : 'text-zinc-400')}>
              {trendValue}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/stats')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setStats(d.stats)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
      </div>
    )
  }

  const wasteChartData = stats
    ? Object.entries(stats.wasteTypeBreakdown)
        .filter(([, v]) => v > 0)
        .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }))
    : []

  const weeklyData = stats?.weeklyTrend || []

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-zinc-900">Command Center</h2>
        <p className="text-sm text-zinc-500">
          Piravom Grama Panchayat · Ernakulam District · Kerala
        </p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Users"
          value={stats?.totalUsers ?? '—'}
          sub={`${stats?.citizens ?? 0} citizens · ${stats?.workers ?? 0} workers`}
          icon={Users}
          trend="up"
          trendValue="+12 this week"
          accent="text-zinc-700"
        />
        <KpiCard
          title="Active Workers"
          value={stats?.workers ?? '—'}
          sub="Across all wards"
          icon={Truck}
          accent="text-sky-500"
        />
        <KpiCard
          title="Pending Signals"
          value={stats?.pendingSignals ?? '—'}
          sub={`${stats?.wasteReadyCount ?? 0} waste-ready homes`}
          icon={Bell}
          trend={stats && stats.pendingSignals > 10 ? 'up' : 'neutral'}
          trendValue={stats && stats.pendingSignals > 10 ? 'High demand' : 'Normal'}
          accent="text-amber-500"
        />
        <KpiCard
          title="Revenue Est."
          value={`₹${((stats?.revenueEstimate ?? 0) / 1000).toFixed(1)}k`}
          sub={`${stats?.collectedCount ?? 0} collections`}
          icon={Wallet}
          trend="up"
          trendValue="↑ 8% vs last week"
          accent="text-emerald-500"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Weekly Trend — 2/3 width */}
        <Card className="lg:col-span-2 bg-white border border-zinc-200 shadow-none">
          <CardHeader className="pb-2 px-5 pt-5">
            <CardTitle className="text-sm font-semibold text-zinc-700 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              Weekly Signal Trend — Predicted vs Actual
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={weeklyData} margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                <XAxis
                  dataKey="day"
                  tick={{ fill: '#a1a1aa', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#a1a1aa', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                />
                <Tooltip
                  contentStyle={{
                    background: '#18181b',
                    border: 'none',
                    borderRadius: 8,
                    color: '#fff',
                    fontSize: 12,
                  }}
                  labelStyle={{ color: '#a1a1aa' }}
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ fill: '#10b981', r: 3 }}
                  name="Actual"
                />
                <Line
                  type="monotone"
                  dataKey="predicted"
                  stroke="#dc2626"
                  strokeWidth={2}
                  strokeDasharray="4 2"
                  dot={{ fill: '#dc2626', r: 3 }}
                  name="ML Predicted"
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex gap-4 px-4 mt-1">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 bg-emerald-500 rounded" />
                <span className="text-[11px] text-zinc-500">Actual</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 bg-rose-600 rounded border-dashed" style={{ borderTop: '2px dashed #dc2626', background: 'none' }} />
                <span className="text-[11px] text-zinc-500">ML Predicted</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Waste Type Donut */}
        <Card className="bg-white border border-zinc-200 shadow-none">
          <CardHeader className="pb-2 px-5 pt-5">
            <CardTitle className="text-sm font-semibold text-zinc-700">
              Waste Type Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center pb-4">
            {wasteChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={wasteChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {wasteChartData.map((entry, i) => (
                      <Cell
                        key={entry.name}
                        fill={WASTE_COLORS[entry.name.toLowerCase()] || '#a1a1aa'}
                        stroke="none"
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: '#18181b',
                      border: 'none',
                      borderRadius: 8,
                      color: '#fff',
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center">
                <p className="text-sm text-zinc-400">No data yet</p>
              </div>
            )}
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 justify-center">
              {Object.entries(WASTE_COLORS).map(([name, color]) => (
                <div key={name} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                  <span className="text-[11px] text-zinc-500 capitalize">{name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: Household Coverage + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Coverage Stats */}
        <Card className="bg-white border border-zinc-200 shadow-none">
          <CardHeader className="pb-2 px-5 pt-5">
            <CardTitle className="text-sm font-semibold text-zinc-700 flex items-center gap-2">
              <Home className="w-4 h-4 text-emerald-500" />
              Household Coverage
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-xs text-zinc-500">Registered</span>
                <span className="text-xs font-semibold text-zinc-700">{stats?.totalHouseholds ?? 0}</span>
              </div>
              <div className="h-1.5 bg-zinc-100 rounded-full">
                <div className="h-1.5 bg-zinc-800 rounded-full" style={{ width: '100%' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-xs text-zinc-500">Waste Ready</span>
                <span className="text-xs font-semibold text-amber-600">{stats?.wasteReadyCount ?? 0}</span>
              </div>
              <div className="h-1.5 bg-zinc-100 rounded-full">
                <div
                  className="h-1.5 bg-amber-400 rounded-full transition-all"
                  style={{
                    width: stats && stats.totalHouseholds > 0
                      ? `${(stats.wasteReadyCount / stats.totalHouseholds) * 100}%`
                      : '0%',
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-xs text-zinc-500">Collected</span>
                <span className="text-xs font-semibold text-emerald-600">{stats?.collectedCount ?? 0}</span>
              </div>
              <div className="h-1.5 bg-zinc-100 rounded-full">
                <div
                  className="h-1.5 bg-emerald-500 rounded-full transition-all"
                  style={{
                    width: stats && stats.totalHouseholds > 0
                      ? `${(stats.collectedCount / stats.totalHouseholds) * 100}%`
                      : '0%',
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="lg:col-span-2 bg-white border border-zinc-200 shadow-none">
          <CardHeader className="pb-2 px-5 pt-5">
            <CardTitle className="text-sm font-semibold text-zinc-700 flex items-center gap-2">
              <Activity className="w-4 h-4 text-zinc-400" />
              Recent Admin Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {(stats?.recentActivity || []).length > 0 ? (
              <div className="space-y-2">
                {stats!.recentActivity.slice(0, 6).map((act) => (
                  <div
                    key={act.id}
                    className="flex items-center justify-between py-1.5 border-b border-zinc-50 last:border-0"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={cn(
                        'w-1.5 h-6 rounded-full',
                        act.action_type === 'role_change' ? 'bg-sky-400' :
                        act.action_type === 'ward_assignment' ? 'bg-amber-400' : 'bg-zinc-300'
                      )} />
                      <div>
                        <p className="text-xs font-medium text-zinc-700 capitalize">
                          {act.action_type.replace('_', ' ')}
                        </p>
                        <p className="text-[11px] text-zinc-400">
                          {act.new_value && typeof act.new_value === 'object'
                            ? JSON.stringify(act.new_value).slice(0, 40)
                            : 'No details'}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] text-zinc-400">
                      {new Date(act.created_at).toLocaleDateString('en-IN', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <Activity className="w-6 h-6 text-zinc-200 mx-auto mb-2" />
                <p className="text-sm text-zinc-400">No activity yet</p>
                <p className="text-xs text-zinc-300">Actions like role changes will appear here</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
