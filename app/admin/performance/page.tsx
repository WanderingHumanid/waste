'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import {
  Users,
  Truck,
  TrendingUp,
  Leaf,
  Target,
  Clock,
  DollarSign,
  Star,
  AlertTriangle,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  Recycle,
  TreeDeciduous,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface WorkerPerformance {
  workerId: string
  workerName: string
  wardNumber: number | null
  totalCollections: number
  totalMissedStops: number
  collectionRate: number
  avgPickupTimeMins: number
  totalDistanceKm: number
  routeEfficiency: number
  totalFeesCollected: number
  avgCitizenRating: number
  wellSegregatedRate: number
  hoursWorked: number
}

interface EnvironmentalImpact {
  totalWasteKg: number
  wetWasteKg: number
  dryWasteKg: number
  recyclableKg: number
  hazardousKg: number
  recyclingRate: number
  compostRate: number
  landfillDiversionRate: number
  co2AvoidedKg: number
  treesEquivalent: number
  plasticBottlesRecycled: number
}

interface OverallKPIs {
  totalHouseholds: number
  householdsServiced: number
  coverageRate: number
  avgResponseTimeMins: number
  onTimeRate: number
  missedStopRate: number
  totalRevenue: number
  avgRevenuePerHousehold: number
  collectionRate: number
  avgCitizenRating: number
  complaintsCount: number
}

interface PerformanceData {
  period: string
  dateRange: { start: string; end: string }
  overallKPIs: OverallKPIs
  workerPerformance: WorkerPerformance[]
  environmentalImpact: EnvironmentalImpact
}

const WASTE_COLORS = {
  wet: '#10b981',
  dry: '#f59e0b',
  recyclable: '#3b82f6',
  hazardous: '#ef4444',
}

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  iconColor = 'text-zinc-600',
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ElementType
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  iconColor?: string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-bold text-zinc-900 mt-1">{value}</p>
            {subtitle && <p className="text-xs text-zinc-400 mt-0.5">{subtitle}</p>}
            {trend && trendValue && (
              <p className={cn(
                'text-xs mt-1 flex items-center gap-1',
                trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-rose-600' : 'text-zinc-400'
              )}>
                {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}
              </p>
            )}
          </div>
          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center bg-zinc-100')}>
            <Icon className={cn('w-5 h-5', iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function PerformanceDashboardPage() {
  const [data, setData] = useState<PerformanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('week')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/performance?period=${period}`)
      const json = await res.json()
      if (json.success) {
        setData(json)
      }
    } catch (error) {
      console.error('Failed to fetch performance data:', error)
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-zinc-500">
        Failed to load performance data
      </div>
    )
  }

  const { overallKPIs, workerPerformance, environmentalImpact } = data

  // Prepare chart data
  const wasteBreakdownData = [
    { name: 'Wet', value: environmentalImpact.wetWasteKg, color: WASTE_COLORS.wet },
    { name: 'Dry', value: environmentalImpact.dryWasteKg, color: WASTE_COLORS.dry },
    { name: 'Recyclable', value: environmentalImpact.recyclableKg, color: WASTE_COLORS.recyclable },
    { name: 'Hazardous', value: environmentalImpact.hazardousKg, color: WASTE_COLORS.hazardous },
  ].filter(d => d.value > 0)

  const workerChartData = workerPerformance.slice(0, 10).map(w => ({
    name: w.workerName.split(' ')[0],
    collections: w.totalCollections,
    missed: w.totalMissedStops,
    rating: w.avgCitizenRating,
  }))

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900">Performance Dashboard</h2>
          <p className="text-sm text-zinc-500">
            KPIs for route efficiency, crew performance, and environmental impact
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={cn('w-4 h-4 mr-1', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Date Range */}
      <p className="text-xs text-zinc-400">
        Data from {data.dateRange.start} to {data.dateRange.end}
      </p>

      {/* Overall KPIs Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          title="Coverage Rate"
          value={`${overallKPIs.coverageRate}%`}
          subtitle={`${overallKPIs.householdsServiced} / ${overallKPIs.totalHouseholds} households`}
          icon={Target}
          iconColor="text-emerald-600"
        />
        <KpiCard
          title="Avg Response Time"
          value={`${overallKPIs.avgResponseTimeMins} min`}
          subtitle="From signal to pickup"
          icon={Clock}
          iconColor="text-blue-600"
        />
        <KpiCard
          title="Collection Rate"
          value={`${overallKPIs.collectionRate}%`}
          subtitle={`${overallKPIs.missedStopRate}% missed`}
          icon={CheckCircle2}
          iconColor="text-emerald-600"
        />
        <KpiCard
          title="Total Revenue"
          value={`₹${overallKPIs.totalRevenue.toLocaleString()}`}
          subtitle={`₹${overallKPIs.avgRevenuePerHousehold} avg per house`}
          icon={DollarSign}
          iconColor="text-amber-600"
        />
        <KpiCard
          title="Citizen Rating"
          value={overallKPIs.avgCitizenRating || '—'}
          subtitle="Out of 5 stars"
          icon={Star}
          iconColor="text-amber-500"
        />
        <KpiCard
          title="On-time Rate"
          value={`${overallKPIs.onTimeRate}%`}
          subtitle="Within SLA window"
          icon={TrendingUp}
          iconColor="text-emerald-600"
        />
        <KpiCard
          title="Complaints"
          value={overallKPIs.complaintsCount}
          subtitle="This period"
          icon={AlertTriangle}
          iconColor="text-rose-500"
        />
        <KpiCard
          title="Total Waste"
          value={`${environmentalImpact.totalWasteKg} kg`}
          subtitle="Collected this period"
          icon={Truck}
          iconColor="text-zinc-600"
        />
      </div>

      {/* Environmental Impact Section */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Leaf className="w-5 h-5 text-emerald-600" />
            Environmental Impact
          </CardTitle>
          <CardDescription>
            Sustainability metrics and waste diversion
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Waste Breakdown Pie Chart */}
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={wasteBreakdownData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {wasteBreakdownData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value} kg`} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Environmental Metrics */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Recycle className="w-5 h-5 text-emerald-600" />
                  <span className="text-sm font-medium">Recycling Rate</span>
                </div>
                <span className="text-lg font-bold text-emerald-700">
                  {environmentalImpact.recyclingRate}%
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Leaf className="w-5 h-5 text-amber-600" />
                  <span className="text-sm font-medium">Compost Rate</span>
                </div>
                <span className="text-lg font-bold text-amber-700">
                  {environmentalImpact.compostRate}%
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium">Landfill Diversion</span>
                </div>
                <span className="text-lg font-bold text-blue-700">
                  {environmentalImpact.landfillDiversionRate}%
                </span>
              </div>
            </div>

            {/* Impact Equivalents */}
            <div className="space-y-4">
              <div className="text-center p-4 bg-zinc-50 rounded-lg">
                <p className="text-3xl font-bold text-emerald-600">
                  {environmentalImpact.co2AvoidedKg}
                </p>
                <p className="text-xs text-zinc-500 mt-1">kg CO₂ Avoided</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-zinc-50 rounded-lg">
                  <TreeDeciduous className="w-6 h-6 mx-auto text-emerald-600" />
                  <p className="text-xl font-bold mt-1">{environmentalImpact.treesEquivalent}</p>
                  <p className="text-xs text-zinc-500">Trees Equivalent</p>
                </div>
                <div className="text-center p-3 bg-zinc-50 rounded-lg">
                  <Recycle className="w-6 h-6 mx-auto text-blue-600" />
                  <p className="text-xl font-bold mt-1">{environmentalImpact.plasticBottlesRecycled}</p>
                  <p className="text-xs text-zinc-500">Bottles Recycled</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Worker Performance Section */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="w-5 h-5 text-blue-600" />
            Crew Performance
          </CardTitle>
          <CardDescription>
            Individual worker metrics and rankings
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Worker Chart */}
          {workerChartData.length > 0 && (
            <div className="h-64 mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workerChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="collections" fill="#10b981" name="Collections" />
                  <Bar dataKey="missed" fill="#ef4444" name="Missed" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Worker Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worker</TableHead>
                  <TableHead className="text-center">Ward</TableHead>
                  <TableHead className="text-center">Collections</TableHead>
                  <TableHead className="text-center">Missed</TableHead>
                  <TableHead className="text-center">Rate</TableHead>
                  <TableHead className="text-center">Fees (₹)</TableHead>
                  <TableHead className="text-center">Rating</TableHead>
                  <TableHead className="text-center">Hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workerPerformance.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-zinc-400 py-8">
                      No worker data available for this period
                    </TableCell>
                  </TableRow>
                ) : (
                  workerPerformance.map((worker) => (
                    <TableRow key={worker.workerId}>
                      <TableCell className="font-medium">{worker.workerName}</TableCell>
                      <TableCell className="text-center">
                        {worker.wardNumber ? (
                          <Badge variant="outline">Ward {worker.wardNumber}</Badge>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-medium text-emerald-600">
                        {worker.totalCollections}
                      </TableCell>
                      <TableCell className="text-center">
                        {worker.totalMissedStops > 0 ? (
                          <span className="text-rose-600">{worker.totalMissedStops}</span>
                        ) : (
                          <span className="text-zinc-400">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={worker.collectionRate >= 90 ? 'default' : worker.collectionRate >= 70 ? 'secondary' : 'destructive'}
                        >
                          {worker.collectionRate}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        ₹{worker.totalFeesCollected.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        {worker.avgCitizenRating > 0 ? (
                          <span className="flex items-center justify-center gap-1">
                            <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                            {worker.avgCitizenRating}
                          </span>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-zinc-600">
                        {worker.hoursWorked}h
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
