'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  Cell,
} from 'recharts'
import {
  Brain,
  AlertTriangle,
  Flame,
  TrendingUp,
  MapPin,
  Calendar,
  Truck,
  RefreshCw,
  Loader2,
  AlertOctagon,
  Clock,
  Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface WardPrediction {
  ward: number
  district: string
  predictedSignals: number
  confidence: number
  historicalAvg: number
  trend: number
  priority: 'low' | 'medium' | 'high' | 'critical'
  extraPickupsNeeded: number
  peakHour: number
  centroid: { lat: number; lng: number } | null
}

interface PredictionsData {
  success: boolean
  predictionDate: string
  predictions: WardPrediction[]
  summary: {
    totalPredictedSignals: number
    totalExtraPickups: number
    highPriorityWards: number
    criticalWards: number
  }
}

const PRIORITY_CONFIG = {
  critical: { color: 'bg-rose-500', text: 'text-rose-700', border: 'border-rose-200', bg: 'bg-rose-50', icon: AlertOctagon },
  high: { color: 'bg-amber-500', text: 'text-amber-700', border: 'border-amber-200', bg: 'bg-amber-50', icon: Flame },
  medium: { color: 'bg-blue-500', text: 'text-blue-700', border: 'border-blue-200', bg: 'bg-blue-50', icon: Activity },
  low: { color: 'bg-green-500', text: 'text-green-700', border: 'border-green-200', bg: 'bg-green-50', icon: TrendingUp },
}

function PriorityBadge({ priority }: { priority: 'low' | 'medium' | 'high' | 'critical' }) {
  const config = PRIORITY_CONFIG[priority]
  return (
    <Badge className={cn(config.bg, config.text, 'border', config.border, 'capitalize')}>
      {priority}
    </Badge>
  )
}

function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = 'text-zinc-600',
  bgColor = 'bg-zinc-50',
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ElementType
  iconColor?: string
  bgColor?: string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', bgColor)}>
            <Icon className={cn('w-6 h-6', iconColor)} />
          </div>
          <div>
            <p className="text-2xl font-bold text-zinc-900">{value}</p>
            <p className="text-sm text-zinc-500">{title}</p>
            {subtitle && <p className="text-xs text-zinc-400">{subtitle}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function PredictionsPage() {
  const [data, setData] = useState<PredictionsData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchPredictions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/predictions')
      const json = await res.json()
      if (json.success) {
        setData(json)
      }
    } catch (error) {
      console.error('Failed to fetch predictions:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPredictions()
  }, [fetchPredictions])

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
        Failed to load prediction data
      </div>
    )
  }

  const { predictions, summary, predictionDate } = data

  // Prepare chart data - sort by predicted signals descending
  const chartData = [...predictions]
    .sort((a, b) => b.predictedSignals - a.predictedSignals)
    .slice(0, 15)
    .map(p => ({
      name: `W${p.ward}`,
      predicted: p.predictedSignals,
      historical: p.historicalAvg,
      extraPickups: p.extraPickupsNeeded,
      priority: p.priority,
    }))

  const getBarColor = (priority: string) => {
    switch (priority) {
      case 'critical': return '#ef4444'
      case 'high': return '#f59e0b'
      case 'medium': return '#3b82f6'
      default: return '#10b981'
    }
  }

  // Separate critical and high priority wards
  const criticalWards = predictions.filter(p => p.priority === 'critical')
  const highPriorityWards = predictions.filter(p => p.priority === 'high')

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-600" />
            Predictive Hotspot Detection
          </h2>
          <p className="text-sm text-zinc-500">
            ML-powered predictions for zones needing extra pickups before overflow
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(predictionDate).toLocaleDateString('en-IN', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </Badge>
          <Button size="sm" variant="outline" onClick={fetchPredictions} disabled={loading}>
            <RefreshCw className={cn('w-4 h-4 mr-1', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          title="Predicted Signals"
          value={summary.totalPredictedSignals}
          subtitle="Tomorrow"
          icon={TrendingUp}
          iconColor="text-blue-600"
          bgColor="bg-blue-50"
        />
        <SummaryCard
          title="Extra Pickups Needed"
          value={summary.totalExtraPickups}
          subtitle="Additional routes"
          icon={Truck}
          iconColor="text-amber-600"
          bgColor="bg-amber-50"
        />
        <SummaryCard
          title="High Priority Wards"
          value={summary.highPriorityWards}
          subtitle="Need attention"
          icon={AlertTriangle}
          iconColor="text-amber-600"
          bgColor="bg-amber-50"
        />
        <SummaryCard
          title="Critical Wards"
          value={summary.criticalWards}
          subtitle="Immediate action"
          icon={Flame}
          iconColor="text-rose-600"
          bgColor="bg-rose-50"
        />
      </div>

      {/* Critical Alerts */}
      {criticalWards.length > 0 && (
        <Card className="border-rose-200 bg-rose-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-rose-700 flex items-center gap-2 text-lg">
              <AlertOctagon className="w-5 h-5" />
              Critical Alert: Overflow Risk
            </CardTitle>
            <CardDescription className="text-rose-600">
              These wards are predicted to have significantly higher demand than usual
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {criticalWards.map(ward => (
                <div
                  key={`${ward.ward}-${ward.district}`}
                  className="p-3 bg-white rounded-lg border border-rose-200 flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold text-zinc-900">Ward {ward.ward}</p>
                    <p className="text-xs text-zinc-500">{ward.district}</p>
                    <p className="text-xs text-rose-600 mt-1">
                      +{ward.extraPickupsNeeded} extra pickups needed
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-rose-600">{ward.predictedSignals}</p>
                    <p className="text-xs text-zinc-400">predicted signals</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Prediction Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Ward Predictions Overview</CardTitle>
          <CardDescription>
            Predicted signals vs historical average by ward
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const data = payload[0].payload
                    return (
                      <div className="bg-white border rounded-lg shadow-lg p-3 text-sm">
                        <p className="font-semibold">{label}</p>
                        <p className="text-blue-600">Predicted: {data.predicted}</p>
                        <p className="text-zinc-500">Historical: {data.historical}</p>
                        <p className="text-amber-600">Extra Pickups: {data.extraPickups}</p>
                        <PriorityBadge priority={data.priority} />
                      </div>
                    )
                  }}
                />
                <Bar dataKey="predicted" name="Predicted">
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={getBarColor(entry.priority)} />
                  ))}
                </Bar>
                <Bar dataKey="historical" fill="#d1d5db" name="Historical Avg" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Full Predictions Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">All Ward Predictions</CardTitle>
          <CardDescription>
            Detailed breakdown by ward with confidence scores
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ward</TableHead>
                  <TableHead>District</TableHead>
                  <TableHead className="text-center">Predicted</TableHead>
                  <TableHead className="text-center">Historical</TableHead>
                  <TableHead className="text-center">Trend</TableHead>
                  <TableHead className="text-center">Confidence</TableHead>
                  <TableHead className="text-center">Peak Hour</TableHead>
                  <TableHead className="text-center">Extra Pickups</TableHead>
                  <TableHead className="text-center">Priority</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {predictions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-zinc-400 py-8">
                      No predictions available
                    </TableCell>
                  </TableRow>
                ) : (
                  predictions.map((pred) => (
                    <TableRow
                      key={`${pred.ward}-${pred.district}`}
                      className={cn(
                        pred.priority === 'critical' && 'bg-rose-50/50',
                        pred.priority === 'high' && 'bg-amber-50/50'
                      )}
                    >
                      <TableCell className="font-semibold">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3 h-3 text-zinc-400" />
                          Ward {pred.ward}
                        </div>
                      </TableCell>
                      <TableCell className="text-zinc-500">{pred.district}</TableCell>
                      <TableCell className="text-center font-bold text-blue-600">
                        {pred.predictedSignals}
                      </TableCell>
                      <TableCell className="text-center text-zinc-500">
                        {pred.historicalAvg}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={pred.trend > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                          {pred.trend > 0 ? '+' : ''}{pred.trend}%
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={cn(
                          pred.confidence >= 80 ? 'text-emerald-600 border-emerald-200' :
                          pred.confidence >= 60 ? 'text-amber-600 border-amber-200' :
                          'text-zinc-500 border-zinc-200'
                        )}>
                          {pred.confidence}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="flex items-center justify-center gap-1 text-zinc-600">
                          <Clock className="w-3 h-3" />
                          {pred.peakHour}:00
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {pred.extraPickupsNeeded > 0 ? (
                          <span className="font-semibold text-amber-600">
                            +{pred.extraPickupsNeeded}
                          </span>
                        ) : (
                          <span className="text-zinc-400">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <PriorityBadge priority={pred.priority} />
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
