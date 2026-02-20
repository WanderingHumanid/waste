'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  MapPin,
  Navigation,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Banknote,
  Phone,
  ChevronRight,
  Brain,
  Flame,
  AlertTriangle,
  Clock,
  TrendingUp,
  AlertTriangle as AlertTriangleIcon
} from 'lucide-react'
import dynamic from 'next/dynamic'

// Dynamically import map to avoid SSR issues
const PickupRadarMap = dynamic(() => import('@/components/worker/pickup-radar-map'), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] bg-amber-900/50 rounded-lg flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
    </div>
  ),
})

interface Household {
  id: string
  user_id: string
  nickname: string
  manual_address: string | null
  geocoded_address: string | null
  ward_number: number
  waste_ready: boolean
  lat: number
  lng: number
  distance_m: number
  profile?: {
    full_name: string | null
    phone: string | null
  }
  ml_prediction?: {
    volume_kg: number
    confidence: number
    urgency: 'low' | 'medium' | 'high' | 'critical'
    priority_score: number
  }
}

interface WardPrediction {
  wardNumber: number
  district: string | null
  predictedVolumeKg: number
  confidence: number
  peakHourStart: number
  peakHourEnd: number
  extraPickupsNeeded: number
  priority: 'low' | 'medium' | 'high' | 'critical'
}

interface PredictionSummary {
  recentSignals24h: number
  totalExtraPickups: number
  totalPredictedVolumeKg: number
  criticalWards: number
  highPriorityWards: number
}

interface Hotspot {
  id: string
  hotspot_name: string
  address: string
  severity: number
  status: string
}

interface WorkerPosition {
  lat: number
  lng: number
  accuracy: number
}

export default function WorkerDashboardPage() {
  const supabase = createClient()
  const [households, setHouseholds] = useState<Household[]>([])
  const [selectedHousehold, setSelectedHousehold] = useState<Household | null>(null)
  const [workerPosition, setWorkerPosition] = useState<WorkerPosition | null>(null)
  const [workerWard, setWorkerWard] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [collecting, setCollecting] = useState(false)
  const [withinRange, setWithinRange] = useState(false)
  const [predictions, setPredictions] = useState<WardPrediction[]>([])
  const [predictionSummary, setPredictionSummary] = useState<PredictionSummary | null>(null)
  const [hotspots, setHotspots] = useState<Hotspot[]>([])
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [gpsPermission, setGpsPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt')
  const watchIdRef = useRef<number | null>(null)
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch worker's ward assignment
  useEffect(() => {
    async function getWorkerWard() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, assignments:worker_assignments(ward_number)')
        .eq('id', user.id)
        .single()

      const assignments = (profile as any)?.assignments
      const ward = Array.isArray(assignments) ? assignments[0]?.ward_number : (assignments?.ward_number || null)

      if (ward) {
        setWorkerWard(ward)
      }
    }
    getWorkerWard()
  }, [supabase])

  // Start GPS tracking
  useEffect(() => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported by browser')
      return
    }

    // Watch position continuously
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setWorkerPosition({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        })
      },
      (error) => {
        let errorMessage = 'Unable to get GPS location'

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied. Please enable GPS in browser settings.'
            setGpsPermission('denied')
            break
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location unavailable. Check device GPS settings.'
            break
          case error.TIMEOUT:
            errorMessage = 'Location request timed out. Retrying...'
            break
        }

        setGpsError((prev) => prev === errorMessage ? prev : errorMessage)
        console.error('GPS error:', error)
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      }
    )

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [])

  // Send heartbeat every 30 seconds
  useEffect(() => {
    if (!workerPosition) return

    const sendHeartbeat = async () => {
      try {
        await fetch('/api/worker/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat: workerPosition.lat,
            lng: workerPosition.lng,
            accuracy: workerPosition.accuracy,
          }),
        })
      } catch (error) {
        console.error('Heartbeat failed:', error)
      }
    }

    // Send initial heartbeat
    sendHeartbeat()

    // Set interval for 30 seconds
    heartbeatIntervalRef.current = setInterval(sendHeartbeat, 30000)

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
      }
    }
  }, [workerPosition])

  // Check if worker is within 50m of selected household
  useEffect(() => {
    if (!workerPosition || !selectedHousehold) {
      setWithinRange(false)
      return
    }

    // Haversine distance calculation
    const R = 6371000 // Earth radius in meters
    const dLat = (selectedHousehold.lat - workerPosition.lat) * Math.PI / 180
    const dLng = (selectedHousehold.lng - workerPosition.lng) * Math.PI / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(workerPosition.lat * Math.PI / 180) * Math.cos(selectedHousehold.lat * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const distance = R * c

    setWithinRange(distance <= 50)
  }, [workerPosition, selectedHousehold])

  // Fetch nearby households with waste_ready = true
  const fetchHouseholds = useCallback(async () => {
    if (!workerPosition) return

    setLoading(true)
    try {
      const response = await fetch('/api/worker/nearby-signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: workerPosition.lat,
          lng: workerPosition.lng,
          radiusMeters: 2000, // 2km radius
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setHouseholds(data.households || [])
      }
    } catch (error) {
      console.error('Failed to fetch households:', error)
    } finally {
      setLoading(false)
    }
  }, [workerPosition])

  // Initial fetch and realtime subscription
  useEffect(() => {
    if (workerPosition) {
      fetchHouseholds()
    }

    // Subscribe to postgres_changes for waste_ready updates
    const postgresChannel = supabase
      .channel('worker-radar-postgres')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'households',
          filter: 'waste_ready=eq.true',
        },
        () => {
          // Refetch when any household becomes ready
          if (workerPosition) {
            fetchHouseholds()
          }
        }
      )
      .subscribe()

    // Subscribe to signals table for new collection requests
    const signalsChannel = supabase
      .channel('worker-radar-signals')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'signals' },
        (payload) => {
          console.log('New signal:', payload)
          toast.info('🔔 New collection request!', {
            description: 'A household needs waste collection.',
          })
          if (workerPosition) {
            fetchHouseholds()
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'signals' },
        () => {
          // Refetch to update status
          if (workerPosition) {
            fetchHouseholds()
          }
        }
      )
      .subscribe()

    // Subscribe to ward-specific broadcast channel for "Digital Bell" events
    let wardChannel: ReturnType<typeof supabase.channel> | null = null
    if (workerWard) {
      const channelName = `ward:Ernakulam:${workerWard}`
      wardChannel = supabase
        .channel(channelName)
        .on('broadcast', { event: 'digital_bell' }, (payload) => {
          console.log('Digital Bell received:', payload)
          toast.info('🔔 New waste signal!', {
            description: `${payload.payload?.nickname || 'A household'} is ready for collection.`,
          })
          // Refetch nearby households
          if (workerPosition) {
            fetchHouseholds()
          }
        })
        .subscribe()
    }

    return () => {
      supabase.removeChannel(postgresChannel)
      supabase.removeChannel(signalsChannel)
      if (wardChannel) {
        supabase.removeChannel(wardChannel)
      }
    }
  }, [workerPosition, workerWard, supabase, fetchHouseholds])

  // Verify anchor (Haversine lock check)
  const handleVerifyAnchor = async () => {
    if (!selectedHousehold || !withinRange) {
      toast.error('You must be within 50m of the household')
      return
    }

    setVerifying(true)
    try {
      const response = await fetch('/api/worker/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          householdId: selectedHousehold.id,
          workerLat: workerPosition?.lat,
          workerLng: workerPosition?.lng,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Location verified! You can now collect.')
      } else {
        toast.error(data.error || 'Verification failed')
      }
    } catch (error) {
      toast.error('Verification failed')
    } finally {
      setVerifying(false)
    }
  }

  // Mark collected + collect payment
  const handleMarkCollected = async () => {
    if (!selectedHousehold || !withinRange) {
      toast.error('You must be within 50m of the household')
      return
    }

    setCollecting(true)
    try {
      const response = await fetch('/api/worker/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          householdId: selectedHousehold.id,
          workerLat: workerPosition?.lat,
          workerLng: workerPosition?.lng,
          paymentReceived: true,
          paymentMethod: 'cash',
          amount: 50,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Collection recorded! ₹50 payment confirmed.')
        setSelectedHousehold(null)
        fetchHouseholds()
      } else {
        toast.error(data.error || 'Collection failed')
      }
    } catch (error) {
      toast.error('Collection failed')
    } finally {
      setCollecting(false)
    }
  }

  return (
    <div className="p-4 space-y-4">
      {/* Status Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${workerPosition ? 'bg-green-500 animate-pulse' :
            gpsPermission === 'denied' ? 'bg-red-500' :
              'bg-amber-500 animate-pulse'
            }`} />
          <span className="text-sm text-amber-200">
            {workerPosition ? 'GPS Active' :
              gpsPermission === 'denied' ? 'GPS Denied' :
                'GPS Inactive'}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchHouseholds}
          disabled={loading || !workerPosition}
          className="bg-amber-800/50 border-amber-700 text-amber-200 hover:bg-amber-700"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div >

      {/* GPS Error Banner */}
      {gpsError && (
        <Card className="bg-rose-900/30 border-rose-700">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-rose-300 font-medium">GPS Error</p>
                <p className="text-rose-300/80 text-sm mt-1">{gpsError}</p>
                {gpsPermission === 'denied' && (
                  <p className="text-rose-300/60 text-xs mt-2">
                    To enable: Click the lock icon in your browser's address bar → Site settings → Location → Allow
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Predictions Summary */}
      {predictionSummary && (predictionSummary.criticalWards > 0 || predictionSummary.highPriorityWards > 0 || predictions.length > 0) && (
        <Card className="bg-gradient-to-r from-purple-900/40 to-amber-900/40 border-purple-700/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-amber-100 flex items-center gap-2 text-base">
              <Brain className="w-5 h-5 text-purple-400" />
              AI Hotspot Predictions
            </CardTitle>
            <CardDescription className="text-amber-300/70 text-xs">
              ML model analysis for your area
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Quick stats row */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-amber-900/40 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-amber-100">{predictionSummary.recentSignals24h}</div>
                <div className="text-[10px] text-amber-500">Signals 24h</div>
              </div>
              <div className="bg-amber-900/40 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-amber-100">{predictionSummary.totalExtraPickups}</div>
                <div className="text-[10px] text-amber-500">Extra Pickups</div>
              </div>
              <div className="bg-amber-900/40 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-amber-100">{predictionSummary.totalPredictedVolumeKg}kg</div>
                <div className="text-[10px] text-amber-500">Predicted Vol.</div>
              </div>
            </div>

            {/* Critical/High priority alerts */}
            {predictions.filter(p => p.priority === 'critical' || p.priority === 'high').slice(0, 3).map((prediction, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 p-3 rounded-lg border ${prediction.priority === 'critical'
                  ? 'bg-rose-500/10 border-rose-500/30'
                  : 'bg-amber-500/10 border-amber-500/30'
                  }`}
              >
                {prediction.priority === 'critical' ? (
                  <Flame className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-amber-100">
                      Ward {prediction.wardNumber}
                    </span>
                    <Badge className={`text-[10px] px-1.5 py-0 ${prediction.priority === 'critical'
                      ? 'bg-rose-500/20 text-rose-300'
                      : 'bg-amber-500/20 text-amber-300'
                      }`}>
                      {prediction.priority}
                    </Badge>
                  </div>
                  <p className="text-xs text-amber-400 mt-0.5">
                    ~{Math.round(prediction.predictedVolumeKg)}kg expected
                    {prediction.extraPickupsNeeded > 0 && ` • +${prediction.extraPickupsNeeded} extra pickups`}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-amber-500">
                    <Clock className="w-3 h-3" />
                    Peak: {prediction.peakHourStart}:00–{prediction.peakHourEnd}:00
                    <span className="ml-1">•</span>
                    <TrendingUp className="w-3 h-3" />
                    {Math.round(prediction.confidence)}% confidence
                  </div>
                </div>
              </div>
            ))}

            {/* Active hotspots */}
            {hotspots.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-amber-400 mb-1.5 font-medium">⚠ Active Hotspots</p>
                {hotspots.slice(0, 2).map((spot) => (
                  <div key={spot.id} className="flex items-center justify-between py-1.5 border-b border-amber-800/30 last:border-0">
                    <div>
                      <p className="text-sm text-amber-100">{spot.hotspot_name}</p>
                      <p className="text-[10px] text-amber-500">{spot.address}</p>
                    </div>
                    <Badge className={`text-[10px] ${spot.severity >= 4 ? 'bg-rose-500/20 text-rose-300' :
                      spot.severity >= 3 ? 'bg-amber-500/20 text-amber-300' :
                        'bg-blue-500/20 text-blue-300'
                      }`}>
                      Sev. {spot.severity}/5
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {/* Map */}
      < Card className="bg-amber-900/50 border-amber-800" >
        <CardHeader className="pb-2">
          <CardTitle className="text-amber-100 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-amber-400" />
            Pickup Radar
          </CardTitle>
          <CardDescription className="text-amber-300/70">
            {households.length} active signals in your area
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PickupRadarMap
            workerPosition={workerPosition}
            households={households}
            selectedHousehold={selectedHousehold}
            onSelectHousehold={setSelectedHousehold}
          />
        </CardContent>
      </Card >

      {/* Selected Household Panel */}
      {selectedHousehold && (
        <Card className="bg-amber-900/50 border-amber-800">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-amber-100">
                  {selectedHousehold.nickname || 'Household'}
                </CardTitle>
                <CardDescription className="text-amber-300/70">
                  {selectedHousehold.manual_address || selectedHousehold.geocoded_address || 'No address'}
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className={withinRange
                  ? 'bg-green-500/20 text-green-400 border-green-500'
                  : 'bg-red-500/20 text-red-400 border-red-500'
                }
              >
                {withinRange ? 'In Range' : `${Math.round(selectedHousehold.distance_m)}m away`}
              </Badge>
            </div>
            <div className="flex items-center gap-4 mt-1">
              <div className="flex items-center gap-1 text-[11px] text-amber-400">
                <Navigation className="w-3 h-3" />
                <span>Road Distance: {selectedHousehold.distance_m > 1000 ? `${(selectedHousehold.distance_m / 1000).toFixed(1)}km` : `${Math.round(selectedHousehold.distance_m)}m`}</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-amber-400">
                <Clock className="w-3 h-3" />
                <span>Est: {Math.ceil(selectedHousehold.distance_m / 250)} min</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Contact Info */}
            {selectedHousehold.profile?.phone && (
              <div className="flex items-center gap-2 text-amber-200">
                <Phone className="w-4 h-4" />
                <a href={`tel:${selectedHousehold.profile.phone}`} className="hover:underline">
                  {selectedHousehold.profile.phone}
                </a>
              </div>
            )}

            {/* Haversine Lock Notice */}
            {!withinRange && (
              <div className="flex items-start gap-2 p-3 bg-red-500/10 rounded-lg border border-red-500/30">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="text-red-300 font-medium">Location Lock Active</p>
                  <p className="text-red-300/70">
                    Move within 50 meters of the household to unlock verification.
                  </p>
                </div>
              </div>
            )}

            {/* External Navigation Button */}
            <Button
              variant="outline"
              className="w-full bg-blue-600/20 border-blue-500 text-blue-300 hover:bg-blue-600/30"
              onClick={() => {
                const url = `https://www.google.com/maps/dir/?api=1&origin=${workerPosition?.lat},${workerPosition?.lng}&destination=${selectedHousehold.lat},${selectedHousehold.lng}&travelmode=driving`
                window.open(url, '_blank')
              }}
            >
              <Navigation className="w-4 h-4 mr-2" />
              Open In Google Maps
            </Button>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={handleVerifyAnchor}
                disabled={!withinRange || verifying}
                className="flex-1 bg-amber-600 hover:bg-amber-500 text-amber-950 disabled:opacity-50"
              >
                {verifying ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Navigation className="w-4 h-4 mr-2" />
                )}
                Verify Anchor
              </Button>

              <Button
                onClick={handleMarkCollected}
                disabled={!withinRange || collecting}
                className="flex-1 bg-green-600 hover:bg-green-500 text-white disabled:opacity-50"
              >
                {collecting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    <Banknote className="w-4 h-4 mr-1" />
                  </>
                )}
                Collect + ₹50
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Household List */}
      <Card className="bg-amber-900/50 border-amber-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-amber-100">Active Signals</CardTitle>
        </CardHeader>
        <CardContent>
          {households.length === 0 ? (
            <div className="text-center py-8 text-amber-300/70">
              No active waste signals in your area
            </div>
          ) : (
            <div className="space-y-2">
              {households
                .sort((a, b) => a.distance_m - b.distance_m)
                .map((household) => (
                  <button
                    key={household.id}
                    onClick={() => setSelectedHousehold(household)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${selectedHousehold?.id === household.id
                      ? 'bg-amber-400/20 border border-amber-400/50'
                      : 'bg-amber-800/30 hover:bg-amber-800/50 border border-transparent'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <MapPin className={`w-5 h-5 ${household.ml_prediction?.urgency === 'critical' ? 'text-rose-400' :
                          household.ml_prediction?.urgency === 'high' ? 'text-orange-400' :
                            household.ml_prediction?.urgency === 'medium' ? 'text-amber-400' :
                              'text-green-400'
                          }`} />
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      </div>
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <p className="text-amber-100 font-medium">
                            {household.nickname || 'Household'}
                          </p>
                          {household.ml_prediction && (
                            <Badge className={`text-[10px] px-1.5 py-0 ${household.ml_prediction.urgency === 'critical' ? 'bg-rose-500/20 text-rose-300' :
                              household.ml_prediction.urgency === 'high' ? 'bg-orange-500/20 text-orange-300' :
                                household.ml_prediction.urgency === 'medium' ? 'bg-amber-500/20 text-amber-300' :
                                  'bg-emerald-500/20 text-emerald-300'
                              }`}>
                              {household.ml_prediction.urgency.toUpperCase()}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-amber-300/70">
                          {Math.round(household.distance_m)}m away • Ward {household.ward_number}
                        </p>
                      </div>
                    </div >
                    <ChevronRight className="w-5 h-5 text-amber-400" />
                  </button >
                ))
              }
            </div >
          )}
        </CardContent >
      </Card >
    </div >
  )
}
