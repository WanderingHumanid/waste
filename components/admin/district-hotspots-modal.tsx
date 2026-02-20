'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  MapPin,
  Users,
  Trash2,
  TrendingUp,
  AlertTriangle,
  Building2,
  Loader2,
  ExternalLink,
  Recycle,
  Truck,
  IndianRupee,
} from 'lucide-react'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts'
import { cn } from '@/lib/utils'

interface DistrictData {
  district_code: string
  district_name: string
  district_name_ml?: string
  headquarters: string
  population_2024_est: number
  area_sqkm: number
  daily_waste_tons: number
  recycling_rate: number
  composting_rate: number
  total_households: number
  households_covered: number
  coverage_pct: number
  active_workers: number
  collection_vehicles: number
  processing_units: number
  annual_revenue_lakhs: number
  annual_expense_lakhs: number
  center_lat: number
  center_lng: number
}

interface Hotspot {
  id: string
  hotspot_name: string
  hotspot_type: string
  severity: number
  address: string
  estimated_volume_cubic_m: number
  waste_composition: Record<string, number>
  recurrence_count: number
  status: string
  priority: number
}

interface DailyStat {
  stat_date: string
  wet_waste_tons: number
  dry_waste_tons: number
  ewaste_kg: number
  hazardous_kg: number
  households_serviced: number
  collection_fees: number
  avg_response_mins: number
  worker_efficiency: number
}

interface Ward {
  ward_number: number
  ward_name: string
  population: number
  hks_workers_count: number
}

interface DistrictHotspotsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  districtCode: string | null
}

const SEVERITY_COLORS = {
  1: 'bg-zinc-100 text-zinc-600',
  2: 'bg-blue-100 text-blue-700',
  3: 'bg-amber-100 text-amber-700',
  4: 'bg-orange-100 text-orange-700',
  5: 'bg-red-100 text-red-700',
}

const SEVERITY_LABELS = {
  1: 'Minor',
  2: 'Low',
  3: 'Medium',
  4: 'High',
  5: 'Critical',
}

const WASTE_COMP_COLORS: Record<string, string> = {
  wet: '#10b981',
  dry: '#f59e0b',
  construction: '#6b7280',
  hazardous: '#ef4444',
  ewaste: '#8b5cf6',
}

export function DistrictHotspotsModal({
  open,
  onOpenChange,
  districtCode,
}: DistrictHotspotsModalProps) {
  const [loading, setLoading] = useState(false)
  const [district, setDistrict] = useState<DistrictData | null>(null)
  const [hotspots, setHotspots] = useState<Hotspot[]>([])
  const [recentStats, setRecentStats] = useState<DailyStat[]>([])
  const [wards, setWards] = useState<Ward[] | null>(null)

  useEffect(() => {
    if (open && districtCode) {
      setLoading(true)
      fetch(`/api/admin/districts?code=${districtCode}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            setDistrict(data.district)
            setHotspots(data.hotspots || [])
            setRecentStats(data.recentStats || [])
            setWards(data.wards || null)
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false))
    }
  }, [open, districtCode])

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (!district) {
    return null
  }

  // Prepare chart data
  const wasteBreakdown = recentStats.length > 0 ? [
    { name: 'Wet', value: recentStats[0].wet_waste_tons, fill: WASTE_COMP_COLORS.wet },
    { name: 'Dry', value: recentStats[0].dry_waste_tons, fill: WASTE_COMP_COLORS.dry },
    { name: 'E-waste', value: recentStats[0].ewaste_kg / 1000, fill: WASTE_COMP_COLORS.ewaste },
    { name: 'Hazardous', value: recentStats[0].hazardous_kg / 1000, fill: WASTE_COMP_COLORS.hazardous },
  ] : []

  const weeklyTrend = recentStats
    .slice()
    .reverse()
    .map((s) => ({
      date: new Date(s.stat_date).toLocaleDateString('en-IN', { weekday: 'short' }),
      wet: s.wet_waste_tons,
      dry: s.dry_waste_tons,
      collected: s.households_serviced,
    }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <span className="text-lg font-bold text-zinc-900">{district.district_name}</span>
              {district.district_name_ml && (
                <span className="ml-2 text-sm text-zinc-400">{district.district_name_ml}</span>
              )}
              <p className="text-xs text-zinc-500 font-normal">
                HQ: {district.headquarters} · {district.area_sqkm.toLocaleString()} km²
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <Card className="bg-zinc-50 border-zinc-100">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-zinc-500" />
                <span className="text-xs text-zinc-500">Population</span>
              </div>
              <p className="text-lg font-bold text-zinc-900 mt-1">
                {(district.population_2024_est / 100000).toFixed(1)}L
              </p>
            </CardContent>
          </Card>
          <Card className="bg-amber-50 border-amber-100">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-amber-600" />
                <span className="text-xs text-amber-600">Daily Waste</span>
              </div>
              <p className="text-lg font-bold text-amber-700 mt-1">
                {district.daily_waste_tons.toFixed(0)} tons
              </p>
            </CardContent>
          </Card>
          <Card className="bg-emerald-50 border-emerald-100">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Recycle className="w-4 h-4 text-emerald-600" />
                <span className="text-xs text-emerald-600">Recycling</span>
              </div>
              <p className="text-lg font-bold text-emerald-700 mt-1">
                {district.recycling_rate}%
              </p>
            </CardContent>
          </Card>
          <Card className="bg-sky-50 border-sky-100">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-sky-600" />
                <span className="text-xs text-sky-600">Workers</span>
              </div>
              <p className="text-lg font-bold text-sky-700 mt-1">
                {district.active_workers.toLocaleString()}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="hotspots" className="mt-4">
          <TabsList className="bg-zinc-100">
            <TabsTrigger value="hotspots" className="gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Hotspots ({hotspots.length})
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              Analytics
            </TabsTrigger>
            {wards && (
              <TabsTrigger value="wards" className="gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                Wards ({wards.length})
              </TabsTrigger>
            )}
          </TabsList>

          {/* Hotspots Tab */}
          <TabsContent value="hotspots" className="mt-4">
            {hotspots.length === 0 ? (
              <div className="py-12 text-center">
                <AlertTriangle className="w-8 h-8 text-zinc-200 mx-auto mb-2" />
                <p className="text-sm text-zinc-500">No active hotspots</p>
                <p className="text-xs text-zinc-400">This district has no reported waste accumulation zones</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                {hotspots.map((h) => (
                  <Card key={h.id} className="border-zinc-200">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-semibold text-zinc-900 text-sm">{h.hotspot_name}</h4>
                            <Badge
                              className={cn(
                                'text-[10px] px-1.5 py-0.5',
                                SEVERITY_COLORS[h.severity as keyof typeof SEVERITY_COLORS]
                              )}
                            >
                              {SEVERITY_LABELS[h.severity as keyof typeof SEVERITY_LABELS]}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 capitalize">
                              {h.hotspot_type}
                            </Badge>
                          </div>
                          <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {h.address}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-zinc-800">{h.estimated_volume_cubic_m}m³</p>
                          <p className="text-[10px] text-zinc-400">{h.recurrence_count}x recurring</p>
                        </div>
                      </div>
                      {/* Waste composition mini bar */}
                      {h.waste_composition && (
                        <div className="flex gap-0.5 mt-2 h-1.5 rounded-full overflow-hidden bg-zinc-100">
                          {Object.entries(h.waste_composition).map(([type, pct]) => (
                            <div
                              key={type}
                              className="h-full"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: WASTE_COMP_COLORS[type] || '#a1a1aa',
                              }}
                              title={`${type}: ${pct}%`}
                            />
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Waste Breakdown Donut */}
              <Card className="border-zinc-200">
                <CardContent className="p-4">
                  <h4 className="text-sm font-semibold text-zinc-700 mb-3">Today&apos;s Waste Breakdown</h4>
                  {wasteBreakdown.length > 0 ? (
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie
                          data={wasteBreakdown}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={65}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {wasteBreakdown.map((entry) => (
                            <Cell key={entry.name} fill={entry.fill} stroke="none" />
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
                          formatter={(val: number) => `${val.toFixed(1)} tons`}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[160px] flex items-center justify-center text-sm text-zinc-400">
                      No data
                    </div>
                  )}
                  <div className="flex flex-wrap gap-3 justify-center mt-2">
                    {wasteBreakdown.map((w) => (
                      <div key={w.name} className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: w.fill }} />
                        <span className="text-[11px] text-zinc-500">{w.name}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Weekly Trend Bar */}
              <Card className="border-zinc-200">
                <CardContent className="p-4">
                  <h4 className="text-sm font-semibold text-zinc-700 mb-3">7-Day Collection Trend</h4>
                  {weeklyTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={weeklyTrend} margin={{ left: -10, right: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                        <XAxis dataKey="date" tick={{ fill: '#a1a1aa', fontSize: 10 }} />
                        <YAxis tick={{ fill: '#a1a1aa', fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{
                            background: '#18181b',
                            border: 'none',
                            borderRadius: 8,
                            fontSize: 11,
                          }}
                        />
                        <Bar dataKey="wet" fill="#10b981" name="Wet" stackId="a" />
                        <Bar dataKey="dry" fill="#f59e0b" name="Dry" stackId="a" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[160px] flex items-center justify-center text-sm text-zinc-400">
                      No data
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Revenue & Coverage */}
              <Card className="border-zinc-200 md:col-span-2">
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-zinc-500">Coverage</p>
                      <p className="text-xl font-bold text-zinc-900">{district.coverage_pct}%</p>
                      <div className="h-1 bg-zinc-100 rounded-full mt-1">
                        <div
                          className="h-1 bg-emerald-500 rounded-full"
                          style={{ width: `${district.coverage_pct}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Composting Rate</p>
                      <p className="text-xl font-bold text-amber-600">{district.composting_rate}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 flex items-center gap-1">
                        <IndianRupee className="w-3 h-3" />
                        Annual Revenue
                      </p>
                      <p className="text-xl font-bold text-emerald-600">
                        ₹{district.annual_revenue_lakhs.toLocaleString()}L
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Collection Vehicles</p>
                      <p className="text-xl font-bold text-sky-600">{district.collection_vehicles}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Wards Tab */}
          {wards && (
            <TabsContent value="wards" className="mt-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[300px] overflow-y-auto pr-2">
                {wards.map((w) => (
                  <Card key={w.ward_number} className="border-zinc-200 hover:border-emerald-200 transition-colors">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <Badge className="bg-zinc-100 text-zinc-700 text-[10px]">
                          Ward {w.ward_number}
                        </Badge>
                        <div className="flex items-center gap-1">
                          <Truck className="w-3 h-3 text-sky-500" />
                          <span className="text-xs font-medium text-sky-600">{w.hks_workers_count}</span>
                        </div>
                      </div>
                      <p className="text-sm font-medium text-zinc-800 mt-1.5 truncate">{w.ward_name}</p>
                      <p className="text-[10px] text-zinc-400">
                        Pop: {w.population.toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          )}
        </Tabs>

        {/* Footer Actions */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-100">
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <a
              href={`https://www.google.com/maps/@${district.center_lat},${district.center_lng},11z`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View on Map
            </a>
          </Button>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
