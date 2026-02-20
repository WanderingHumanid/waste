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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Truck,
  Clock,
  MapPin,
  Users,
  RefreshCw,
  ArrowRightLeft,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Send
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface Worker {
  id: string
  full_name: string | null
  ward_number: number | null
  district: string | null
  phone: string | null
  is_active: boolean
  last_seen: string | null
  current_location?: {
    lat: number
    lng: number
  }
  collections_today: number
}

interface Ward {
  ward_number: number
  name: string
  active_signals: number
  assigned_workers: number
}

interface FleetStats {
  active_workers: number
  total_workers: number
  total_collections_today: number
  avg_collection_time_mins: number
  hotspot_wards: number[]
}

export default function AdminFleetPage() {
  const supabase = createClient()

  const [workers, setWorkers] = useState<Worker[]>([])
  const [wards, setWards] = useState<Ward[]>([])
  const [stats, setStats] = useState<FleetStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [reassigning, setReassigning] = useState<string | null>(null)
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null)
  const [targetWard, setTargetWard] = useState<string>('')

  const fetchFleetData = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch workers with role = worker or hks_worker
      const { data: workersData, error: workersError } = await supabase
        .from('profiles')
        .select('id, full_name, ward_number, district, phone')
        .in('role', ['worker', 'hks_worker'])
        .order('ward_number', { ascending: true })

      if (workersError) throw workersError

      // Fetch worker assignments
      const { data: assignments } = await supabase
        .from('worker_assignments')
        .select('worker_id, ward_number, is_active')

      // Fetch recent worker locations (last 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const { data: locations } = await supabase
        .from('worker_locations')
        .select('worker_id, recorded_at')
        .gte('recorded_at', fiveMinutesAgo)

      // Fetch today's collections per worker
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)
      const { data: collections } = await supabase
        .from('signals')
        .select('assigned_to')
        .eq('status', 'collected')
        .gte('collected_at', startOfDay.toISOString())

      // Fetch active signals per ward
      const { data: activeSignals } = await supabase
        .from('households')
        .select('ward_number')
        .eq('waste_ready', true)

      // Process workers
      const processedWorkers: Worker[] = (workersData || []).map(w => {
        const assignment = assignments?.find(a => a.worker_id === w.id)
        const location = locations && Array.isArray(locations) ? locations.find(l => l.worker_id === w.id) : null
        const workerCollections = collections?.filter(c => c.assigned_to === w.id).length || 0

        return {
          id: w.id,
          full_name: w.full_name,
          ward_number: assignment?.ward_number || w.ward_number,
          district: w.district,
          phone: w.phone,
          is_active: !!location,
          last_seen: location?.recorded_at || null,
          collections_today: workerCollections,
        }
      })

      // Process wards (1-19 for Piravom)
      const wardData: Ward[] = Array.from({ length: 19 }, (_, i) => {
        const wardNum = i + 1
        const signals = activeSignals?.filter(s => s.ward_number === wardNum).length || 0
        const assignedWorkers = processedWorkers.filter(w => w.ward_number === wardNum).length

        return {
          ward_number: wardNum,
          name: `Ward ${wardNum}`,
          active_signals: signals,
          assigned_workers: assignedWorkers,
        }
      })

      // Calculate stats
      const activeWorkerCount = processedWorkers.filter(w => w.is_active).length
      const totalCollections = processedWorkers.reduce((sum, w) => sum + w.collections_today, 0)
      const hotspots = wardData
        .filter(w => w.active_signals > 3 && w.assigned_workers === 0)
        .map(w => w.ward_number)

      setWorkers(processedWorkers)
      setWards(wardData)
      setStats({
        active_workers: activeWorkerCount,
        total_workers: processedWorkers.length,
        total_collections_today: totalCollections,
        avg_collection_time_mins: 15, // Placeholder - would need actual timing data
        hotspot_wards: hotspots,
      })
    } catch (error) {
      console.error('Failed to fetch fleet data:', error)
      toast.error('Failed to load fleet data')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchFleetData()

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchFleetData, 30000)
    return () => clearInterval(interval)
  }, [fetchFleetData])

  const handleReassignWorker = async () => {
    if (!selectedWorker || !targetWard) return

    setReassigning(selectedWorker.id)
    try {
      // Update worker assignment
      const { error } = await supabase
        .from('worker_assignments')
        .upsert({
          worker_id: selectedWorker.id,
          ward_number: parseInt(targetWard),
          is_active: true,
          assigned_at: new Date().toISOString(),
        }, { onConflict: 'worker_id' })

      if (error) throw error

      // Also update profile ward_number
      await supabase
        .from('profiles')
        .update({ ward_number: parseInt(targetWard) })
        .eq('id', selectedWorker.id)

      toast.success('Worker reassigned', {
        description: `${selectedWorker.full_name || 'Worker'} assigned to Ward ${targetWard}`,
      })

      setSelectedWorker(null)
      setTargetWard('')
      fetchFleetData()
    } catch (error) {
      console.error('Reassignment failed:', error)
      toast.error('Failed to reassign worker')
    } finally {
      setReassigning(null)
    }
  }

  const handleDeployReinforcements = async (wardNumber: number) => {
    // Find idle workers from adjacent wards
    const adjacentWards = [wardNumber - 1, wardNumber + 1].filter(w => w >= 1 && w <= 19)
    const idleWorkers = workers.filter(w =>
      adjacentWards.includes(w.ward_number || 0) &&
      !w.is_active
    )

    if (idleWorkers.length === 0) {
      toast.error('No available workers in adjacent wards')
      return
    }

    // Reassign first available worker
    const worker = idleWorkers[0]
    setSelectedWorker(worker)
    setTargetWard(wardNumber.toString())
    await handleReassignWorker()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-zinc-900">Fleet Dispatch</h2>
          <p className="text-sm text-zinc-500">Real-time worker management and deployment</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchFleetData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-white border-zinc-200 shadow-none">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="p-2 bg-sky-100 rounded-lg">
              <Truck className="w-5 h-5 text-sky-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Active Workers</p>
              <p className="text-xl font-bold text-zinc-900">
                {stats?.active_workers || 0} / {stats?.total_workers || 0}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-zinc-200 shadow-none">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Avg. Collection Time</p>
              <p className="text-xl font-bold text-zinc-900">{stats?.avg_collection_time_mins || 0} min</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-zinc-200 shadow-none">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Collections Today</p>
              <p className="text-xl font-bold text-zinc-900">{stats?.total_collections_today || 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-zinc-200 shadow-none">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Hotspot Wards</p>
              <p className="text-xl font-bold text-zinc-900">{stats?.hotspot_wards.length || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hotspot Alerts */}
      {stats && stats.hotspot_wards.length > 0 && (
        <Card className="bg-red-50 border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-red-800 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Hotspot Alert — Unattended Wards
            </CardTitle>
            <CardDescription className="text-red-600">
              These wards have high signal density but no active workers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {stats.hotspot_wards.map(wardNum => (
                <div key={wardNum} className="flex items-center gap-2">
                  <Badge variant="destructive">Ward {wardNum}</Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-red-300 text-red-700 hover:bg-red-100"
                    onClick={() => handleDeployReinforcements(wardNum)}
                  >
                    <Send className="w-3 h-3 mr-1" />
                    Deploy
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Workers Table */}
      <Card className="bg-white border-zinc-200 shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-600" />
            Field Workers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200">
                  <th className="text-left py-2 px-3 font-medium text-zinc-600">Worker</th>
                  <th className="text-left py-2 px-3 font-medium text-zinc-600">Ward</th>
                  <th className="text-left py-2 px-3 font-medium text-zinc-600">Status</th>
                  <th className="text-left py-2 px-3 font-medium text-zinc-600">Collections</th>
                  <th className="text-left py-2 px-3 font-medium text-zinc-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {workers.map(worker => (
                  <tr key={worker.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                    <td className="py-3 px-3">
                      <div>
                        <p className="font-medium text-zinc-900">{worker.full_name || 'Unknown'}</p>
                        <p className="text-xs text-zinc-500">{worker.phone || 'No phone'}</p>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                        Ward {worker.ward_number || '—'}
                      </Badge>
                    </td>
                    <td className="py-3 px-3">
                      {worker.is_active ? (
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                          <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-zinc-100 text-zinc-600">
                          Offline
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 px-3 font-medium">{worker.collections_today}</td>
                    <td className="py-3 px-3">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedWorker(worker)}
                          >
                            <ArrowRightLeft className="w-4 h-4 mr-1" />
                            Reassign
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Reassign Worker</DialogTitle>
                            <DialogDescription>
                              Move {selectedWorker?.full_name || 'worker'} to a different ward
                            </DialogDescription>
                          </DialogHeader>
                          <div className="py-4">
                            <Select value={targetWard} onValueChange={setTargetWard}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select target ward" />
                              </SelectTrigger>
                              <SelectContent>
                                {wards.map(ward => (
                                  <SelectItem key={ward.ward_number} value={ward.ward_number.toString()}>
                                    Ward {ward.ward_number} — {ward.active_signals} signals, {ward.assigned_workers} workers
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <DialogFooter>
                            <Button
                              onClick={handleReassignWorker}
                              disabled={!targetWard || reassigning === selectedWorker?.id}
                            >
                              {reassigning === selectedWorker?.id && (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              )}
                              Confirm Reassignment
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </td>
                  </tr>
                ))}
                {workers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-zinc-500">
                      No workers found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Ward Overview */}
      <Card className="bg-white border-zinc-200 shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-600" />
            Ward Coverage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {wards.map(ward => (
              <div
                key={ward.ward_number}
                className={`p-3 rounded-lg border ${ward.active_signals > 0 && ward.assigned_workers === 0
                    ? 'bg-red-50 border-red-200'
                    : ward.active_signals > 0
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-zinc-50 border-zinc-200'
                  }`}
              >
                <p className="font-medium text-sm">Ward {ward.ward_number}</p>
                <div className="flex items-center gap-2 mt-1 text-xs">
                  <span className="text-amber-600">{ward.active_signals} signals</span>
                  <span className="text-zinc-400">•</span>
                  <span className="text-emerald-600">{ward.assigned_workers} workers</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
