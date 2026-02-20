'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Map,
  Layers,
  Loader2,
  Brain,
  Bell,
  Home,
  TrendingUp,
  MapPin,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const KERALA_DISTRICTS = [
  'Ernakulam', 'Thiruvananthapuram', 'Kollam', 'Pathanamthitta', 'Alappuzha',
  'Kottayam', 'Idukki', 'Thrissur', 'Palakkad', 'Malappuram',
  'Kozhikode', 'Wayanad', 'Kannur', 'Kasaragod',
]

// Map client prop types (mirrored from admin-map-client for dynamic import typing)
interface AdminMapClientProps {
  center: { lat: number; lng: number }
  layers: {
    signals: Array<{ id: string; lat: number; lng: number; intensity: number; status: string; ward: number | null; wasteTypes: string[] }>
    households: Array<{ id: string; lat: number; lng: number; wasteReady: boolean; ward: number | null }>
    mlPredictions: Array<{ id: string; lat: number; lng: number; intensity: number; predictedVolume: number; confidence: number; peakHour: string }>
    workers: Array<{ id: string; name: string; ward: number | null; district: string | null }>
  }
  activeLayers: Set<string>
}

interface HotspotData {
  layers: {
    signals: Array<{ id: string; lat: number; lng: number; intensity: number; status: string; ward: number | null; wasteTypes: string[] }>
    households: Array<{ id: string; lat: number; lng: number; wasteReady: boolean; ward: number | null }>
    mlPredictions: Array<{ id: string; lat: number; lng: number; intensity: number; predictedVolume: number; confidence: number; peakHour: string }>
    workers: Array<{ id: string; name: string; ward: number | null; district: string | null }>
  }
  topWards: Array<{ ward: number; signalCount: number; householdCount: number }>
  center: { lat: number; lng: number }
}

// Dynamically import the Leaflet map (no SSR)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AdminMapClient = dynamic<AdminMapClientProps>(
  () => import('../../../components/admin/admin-map-client') as any,
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full w-full bg-zinc-950 rounded-xl">
        <Loader2 className="w-5 h-5 animate-spin text-zinc-600" />
      </div>
    ),
  }
)

type LayerKey = 'signals' | 'households' | 'mlPredictions'

export default function AdminMapPage() {
  const searchParams = useSearchParams()
  const [data, setData] = useState<HotspotData | null>(null)
  const [loading, setLoading] = useState(true)
  const [district, setDistrict] = useState('Ernakulam')
  const [activeLayers, setActiveLayers] = useState<Set<LayerKey>>(
    new Set(['signals', 'mlPredictions'])
  )

  // Sync map layers when URL query params change
  useEffect(() => {
    const layer = searchParams.get('layer')
    if (layer === 'hotspots') {
      setActiveLayers(new Set(['signals']))
    } else if (layer === 'predictions') {
      setActiveLayers(new Set(['mlPredictions']))
    } else {
      setActiveLayers(new Set(['signals', 'mlPredictions'])) // Default
    }
  }, [searchParams])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/hotspots?district=${encodeURIComponent(district)}`)
      const json = await res.json()
      if (json.success) setData(json)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [district])

  useEffect(() => {
    fetchData()
    // Auto-refresh every 30s for real-time updates
    const interval = setInterval(fetchData, 30000)

    // Real-time subscription for signals
    const supabase = createClient()
    const channel = supabase
      .channel('admin-map-signals')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'signals' },
        (payload) => {
          console.log('Map: New signal received:', payload)
          fetchData() // Refresh map data
          toast.info('New Signal', {
            description: 'Map updated with new collection request',
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'signals' },
        () => fetchData()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'households' },
        () => fetchData()
      )
      .subscribe()

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [fetchData])

  const toggleLayer = (layer: LayerKey) => {
    setActiveLayers((prev) => {
      const next = new Set(prev)
      if (next.has(layer)) {
        next.delete(layer)
      } else {
        next.add(layer)
      }
      return next
    })
  }

  const signalCount = data?.layers.signals.length ?? 0
  const predCount = data?.layers.mlPredictions.length ?? 0
  const hhCount = data?.layers.households.length ?? 0

  return (
    <div className="space-y-4 max-w-full h-[calc(100vh-8rem)]">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-zinc-900">Geospatial Intelligence</h2>
          <p className="text-sm text-zinc-500">
            Real-time waste signals + ML-predicted hotspots
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={district} onValueChange={setDistrict}>
            <SelectTrigger className="h-8 w-40 text-xs border-zinc-200 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-48">
              <SelectItem value="all">All Districts</SelectItem>
              {KERALA_DISTRICTS.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs border-zinc-200"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw className={cn('w-3.5 h-3.5 mr-1', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex gap-4 h-[calc(100%-4rem)]">
        {/* Left: Map */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          {/* Layer Toggles */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => toggleLayer('signals')}
              className={cn(
                'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all',
                activeLayers.has('signals')
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-white text-zinc-500 border-zinc-200 hover:border-amber-300'
              )}
            >
              <Bell className="w-3 h-3" />
              Live Signals ({signalCount})
            </button>
            <button
              onClick={() => toggleLayer('mlPredictions')}
              className={cn(
                'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all',
                activeLayers.has('mlPredictions')
                  ? 'bg-rose-600 text-white border-rose-600'
                  : 'bg-white text-zinc-500 border-zinc-200 hover:border-rose-300'
              )}
            >
              <Brain className="w-3 h-3" />
              ML Predictions ({predCount})
            </button>
            <button
              onClick={() => toggleLayer('households')}
              className={cn(
                'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all',
                activeLayers.has('households')
                  ? 'bg-sky-500 text-white border-sky-500'
                  : 'bg-white text-zinc-500 border-zinc-200 hover:border-sky-300'
              )}
            >
              <Home className="w-3 h-3" />
              Households ({hhCount})
            </button>
            <div className="flex items-center gap-1.5 text-xs text-zinc-400 ml-auto">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </div>
          </div>

          {/* Map */}
          <div className="flex-1 rounded-xl overflow-hidden border border-zinc-200 shadow-sm min-h-[400px]">
            {data ? (
              <AdminMapClient
                center={data.center}
                layers={data.layers}
                activeLayers={activeLayers}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-zinc-950">
                <Loader2 className="w-5 h-5 animate-spin text-zinc-600" />
              </div>
            )}
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-64 flex-shrink-0 hidden lg:flex flex-col gap-3 overflow-y-auto">
          {/* Map Legend */}
          <Card className="bg-white border-zinc-200 shadow-none">
            <CardHeader className="px-4 pt-4 pb-2">
              <CardTitle className="text-xs font-semibold text-zinc-600 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                Legend
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-400 border-2 border-amber-600" />
                <span className="text-xs text-zinc-500">Pending signal</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-200 border-2 border-amber-400" />
                <span className="text-xs text-zinc-500">Acknowledged</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-600 border-2 border-rose-800" />
                <span className="text-xs text-zinc-500">ML hotspot prediction</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-sky-400 border-2 border-sky-600" />
                <span className="text-xs text-zinc-500">Household (registered)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-emerald-700" />
                <span className="text-xs text-zinc-500">Waste ready</span>
              </div>
            </CardContent>
          </Card>

          {/* Top 5 Hotspot Wards */}
          <Card className="bg-white border-zinc-200 shadow-none flex-1">
            <CardHeader className="px-4 pt-4 pb-2">
              <CardTitle className="text-xs font-semibold text-zinc-600 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-rose-500" />
                Top Hotspot Wards
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {(data?.topWards || []).length > 0 ? (
                data!.topWards.map((w, i) => (
                  <div key={w.ward} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0',
                        i === 0 ? 'bg-rose-100 text-rose-700' : i === 1 ? 'bg-amber-100 text-amber-700' : 'bg-zinc-100 text-zinc-600'
                      )}>
                        {i + 1}
                      </span>
                      <span className="text-xs text-zinc-700 font-medium">Ward {w.ward}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-xs font-semibold text-rose-600">{w.signalCount} signals</span>
                      <span className="text-[10px] text-zinc-400">{w.householdCount} homes</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-zinc-400 py-4 text-center">
                  No signal data yet
                </p>
              )}
            </CardContent>
          </Card>

          {/* ML Predictions Summary */}
          <Card className="bg-white border-zinc-200 shadow-none">
            <CardHeader className="px-4 pt-4 pb-2">
              <CardTitle className="text-xs font-semibold text-zinc-600 flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5 text-rose-600" />
                ML Peak Predictions
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {(data?.layers.mlPredictions || []).slice(0, 4).map((pred) => (
                <div key={pred.id} className="p-2 rounded-lg bg-rose-50 border border-rose-100">
                  <div className="flex justify-between mb-0.5">
                    <span className="text-[10px] text-rose-700 font-medium">
                      {pred.predictedVolume} kg predicted
                    </span>
                    <span className="text-[10px] text-rose-500">{pred.confidence}% conf.</span>
                  </div>
                  <p className="text-[10px] text-zinc-500">{pred.peakHour}</p>
                  <div
                    className="mt-1 h-1 rounded-full bg-rose-200"
                  >
                    <div
                      className="h-1 rounded-full bg-rose-500"
                      style={{ width: `${pred.intensity * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
