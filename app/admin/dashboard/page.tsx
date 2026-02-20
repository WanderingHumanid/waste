'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
  MapPin,
  AlertTriangle,
  Building2,
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
import { DistrictHotspotsModal } from '@/components/admin/district-hotspots-modal'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface DistrictSummary {
  district_code: string
  district_name: string
  daily_waste_tons: number
  coverage_pct: number
  active_workers: number
  active_hotspots: number
  center_lat: number
  center_lng: number
}

interface StateStats {
  totalPopulation: number
  totalWasteTons: number
  totalHouseholds: number
  totalCovered: number
  totalWorkers: number
  totalRevenue: number
  totalHotspots: number
}

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
  userTrend: number
  userTrendPct: number
  signalTrend: number
  thisWeekUsers: number
  thisWeekSignals: number
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
  const [districts, setDistricts] = useState<DistrictSummary[]>([])
  const [stateStats, setStateStats] = useState<StateStats | null>(null)
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null)
  const [districtModalOpen, setDistrictModalOpen] = useState(false)

  const fetchStats = useCallback(() => {
    fetch('/api/admin/stats')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setStats(d.stats)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    // Fetch main stats
    fetchStats()

    // Fetch Kerala districts
    fetch('/api/admin/districts')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setDistricts(d.districts || [])
          setStateStats(d.stateStats || null)
        }
      })
      .catch(console.error)

    // Set up real-time subscription for signals
    const supabase = createClient()
    const channel = supabase
      .channel('admin-dashboard-signals')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'signals' },
        (payload) => {
          console.log('New signal received:', payload)
          // Refresh stats when new signal arrives
          fetchStats()
          toast.success('New Collection Signal', {
            description: `A household has requested waste collection.`,
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'signals' },
        (payload) => {
          console.log('Signal updated:', payload)
          // Refresh stats when signal status changes
          fetchStats()
        }
      )
      .subscribe()

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchStats])

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
          trend={stats && stats.userTrend > 0 ? 'up' : stats && stats.userTrend < 0 ? 'down' : 'neutral'}
          trendValue={stats ? `${stats.userTrend >= 0 ? '+' : ''}${stats.thisWeekUsers} this week` : undefined}
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
          trend={stats && stats.signalTrend > 0 ? 'up' : stats && stats.signalTrend < 0 ? 'down' : 'neutral'}
          trendValue={stats ? `${stats.signalTrend >= 0 ? '↑' : '↓'} ${Math.abs(stats.signalTrend)}% vs last week` : undefined}
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

      {/* Kerala Districts Grid */}
      {districts.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-zinc-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-500" />
                Kerala Districts
              </h3>
              <p className="text-xs text-zinc-500">
                {stateStats ? `${(stateStats.totalWasteTons).toFixed(0)} tons daily · ${stateStats.totalWorkers.toLocaleString()} workers statewide` : 'Click a district for details'}
              </p>
            </div>
            {stateStats && stateStats.totalHotspots > 0 && (
              <Badge className="bg-red-50 text-red-700 border-red-200 gap-1">
                <AlertTriangle className="w-3 h-3" />
                {stateStats.totalHotspots} Active Hotspots
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2">
            {districts.map((d) => (
              <Card
                key={d.district_code}
                className={cn(
                  'bg-white border border-zinc-200 shadow-none cursor-pointer transition-all hover:border-emerald-300 hover:shadow-sm',
                  d.active_hotspots > 0 && 'border-l-2 border-l-red-400'
                )}
                onClick={() => {
                  setSelectedDistrict(d.district_code)
                  setDistrictModalOpen(true)
                }}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-sm font-semibold text-zinc-800 truncate">{d.district_name}</p>
                    {d.active_hotspots > 0 && (
                      <Badge className="bg-red-100 text-red-700 text-[9px] px-1 py-0 ml-1">
                        {d.active_hotspots}
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-zinc-400">Waste</span>
                      <span className="font-medium text-zinc-600">{d.daily_waste_tons.toFixed(0)}t</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-zinc-400">Coverage</span>
                      <span className="font-medium text-emerald-600">{d.coverage_pct}%</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-zinc-400 flex items-center gap-0.5">
                        <Truck className="w-2.5 h-2.5" />
                      </span>
                      <span className="font-medium text-sky-600">{d.active_workers}</span>
                    </div>
                  </div>
                  {/* Mini coverage bar */}
                  <div className="h-1 bg-zinc-100 rounded-full mt-2">
                    <div
                      className="h-1 bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${Math.min(d.coverage_pct, 100)}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* District Hotspots Modal */}
      <DistrictHotspotsModal
        open={districtModalOpen}
        onOpenChange={setDistrictModalOpen}
        districtCode={selectedDistrict}
      />
    </div>
  )
}
