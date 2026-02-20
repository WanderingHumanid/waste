'use client'

import React, { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { ZoneState } from '@/lib/waste_engine'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Loader2, Navigation, Clock, MapPin, AlertCircle, CheckCircle2 } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import { PickupConfirmationModal } from '@/components/worker/pickup-confirmation-modal'
import { toast } from 'sonner'

// Dynamically import Leaflet components to avoid SSR issues
const MapContainer = dynamic(() => import('react-leaflet').then((mod) => mod.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then((mod) => mod.TileLayer), { ssr: false })
const CircleMarker = dynamic(() => import('react-leaflet').then((mod) => mod.CircleMarker), { ssr: false })
const Popup = dynamic(() => import('react-leaflet').then((mod) => mod.Popup), { ssr: false })
const Tooltip = dynamic(() => import('react-leaflet').then((mod) => mod.Tooltip), { ssr: false })
const Polyline = dynamic(() => import('react-leaflet').then((mod) => mod.Polyline), { ssr: false })
const UseMapComponent = dynamic(() => import('react-leaflet').then((mod) => {
  // Create a component that uses the useMap hook
  const { useMap } = mod;
  const FitBoundsInner = ({ bounds }: { bounds: [number, number][] }) => {
    const map = useMap();
    React.useEffect(() => {
      if (bounds.length > 0) {
        const L = require('leaflet');
        const leafletBounds = L.latLngBounds(bounds);
        map.fitBounds(leafletBounds, { padding: [50, 50], maxZoom: 14 });
      }
    }, [bounds, map]);
    return null;
  };
  return FitBoundsInner;
}), { ssr: false })

const RISK_COLORS = {
  LOW: '#22c55e',
  MEDIUM: '#eab308',
  HIGH: '#f97316',
  CRITICAL: '#ef4444',
}

const PIRAVOM_CENTER: [number, number] = [9.8733, 76.4974]

interface RouteZone extends ZoneState {
  distanceFromPrevious: number
  estimatedTime: number
  is_household_signal?: boolean
  household_id?: string
  nickname?: string
  ward_number?: number | null
  waste_types?: string[]
}

interface HouseholdSignal {
  id: string
  name: string
  lat: number
  lon: number
  fill_percentage: number
  risk_level: string
  is_household_signal: true
  household_id: string
  nickname: string
  ward_number: number | null
  waste_types: string[]
}

interface RouteOptimizationResult {
  success: boolean
  route: RouteZone[]
  totalDistance: number
  estimatedTotalTime: number
  hotspotCount: number
  householdSignalCount: number
}

// Component to render route line
function RouteLine({ route, routePath }: { route: RouteZone[], routePath: [number, number][] | null }) {
  if (routePath) {
    return (
      <Polyline
        positions={routePath}
        pathOptions={{
          color: '#3b82f6',
          weight: 4,
          opacity: 0.8,
        }}
      />
    )
  }

  return (
    <>
      {route.length >= 2 && (
        <Polyline
          positions={route.map((z) => [z.lat, z.lon])}
          pathOptions={{
            color: '#3b82f6',
            weight: 3,
            opacity: 0.7,
            dashArray: '5, 5',
          }}
        />
      )}
    </>
  )
}

async function fetchOSRMRoute(waypoints: { lat: number, lon: number }[]): Promise<[number, number][] | null> {
  if (waypoints.length < 2) return null;
  const coords = waypoints.map(w => `${w.lon},${w.lat}`).join(';');
  try {
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`);
    const data = await res.json();
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      return data.routes[0].geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
    }
  } catch (error) {
    console.error("Error fetching OSRM route:", error);
  }
  return null;
}

export function WasteRouteOptimizer() {
  const [zones, setZones] = useState<ZoneState[]>([])
  const [householdSignals, setHouseholdSignals] = useState<HouseholdSignal[]>([])
  const [route, setRoute] = useState<RouteZone[]>([])
  const [loading, setLoading] = useState(true)
  const [mapReady, setMapReady] = useState(false)
  const [optimizing, setOptimizing] = useState(false)
  const [workerLocation, setWorkerLocation] = useState<[number, number]>(PIRAVOM_CENTER)
  const [routeInfo, setRouteInfo] = useState<RouteOptimizationResult | null>(null)
  const [routePath, setRoutePath] = useState<[number, number][] | null>(null)
  const [currentZoneIndex, setCurrentZoneIndex] = useState(0)
  const [completingZoneId, setCompletingZoneId] = useState<string | null>(null)

  // Confirmation modal state
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [confirmingZone, setConfirmingZone] = useState<RouteZone | null>(null)

  // Open confirmation modal instead of completing directly
  const handleRequestComplete = (zone: RouteZone) => {
    setConfirmingZone(zone)
    setConfirmModalOpen(true)
  }

  // Handle confirmed pickup (with photo proof)
  const handlePickupConfirmed = async (photoUrl?: string) => {
    if (!confirmingZone) return
    const zoneId = confirmingZone.id
    setCompletingZoneId(zoneId)
    try {
      const res = await fetch(`/api/waste/collect/${zoneId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 1000, photoUrl }),
      })
      if (res.ok) {
        setCurrentZoneIndex((prev) => prev + 1)
      }
    } catch (error) {
      console.error('Error completing zone:', error)
    } finally {
      setCompletingZoneId(null)
      setConfirmingZone(null)
    }
  }

  // Handle declined pickup (with reason)
  const handlePickupDeclined = async (reason: string, details: string) => {
    if (!confirmingZone) return
    try {
      // Log as missed stop if it's a household signal
      if (confirmingZone.is_household_signal && confirmingZone.household_id) {
        await fetch('/api/worker/missed-stop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            householdId: confirmingZone.household_id,
            reason,
            reasonDetails: details,
            gpsLat: workerLocation[0],
            gpsLng: workerLocation[1],
          }),
        })
      }
      // Skip this zone in the route
      setCurrentZoneIndex((prev) => prev + 1)
      toast.info(`Skipped ${confirmingZone.name} — reason: ${reason}`)
    } catch (error) {
      console.error('Error logging decline:', error)
    } finally {
      setConfirmingZone(null)
    }
  }

  useEffect(() => {
    setMapReady(true)
    const fetchData = async () => {
      try {
        // Fetch both zones and household signals in parallel
        const [zonesRes, householdsRes] = await Promise.all([
          fetch('/api/waste/zones'),
          fetch('/api/waste/ready-households'),
        ])

        if (zonesRes.ok) {
          const data = await zonesRes.json()
          setZones(data.zones)
        }

        if (householdsRes.ok) {
          const data = await householdsRes.json()
          setHouseholdSignals(data.signals || [])
        }

        setLoading(false)
      } catch (error) {
        console.error('Error fetching data:', error)
        setLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [])

  const handleOptimizeRoute = async () => {
    setOptimizing(true)
    setCurrentZoneIndex(0)
    setRoutePath(null)
    try {
      const res = await fetch('/api/waste/optimize-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerLat: workerLocation[0],
          workerLng: workerLocation[1],
        }),
      })

      if (res.ok) {
        const data: RouteOptimizationResult = await res.json()
        setRoute(data.route)
        setRouteInfo(data)

        const waypoints = [
          { lat: workerLocation[0], lon: workerLocation[1] },
          ...data.route
        ]
        const path = await fetchOSRMRoute(waypoints)
        if (path) setRoutePath(path)
      }
    } catch (error) {
      console.error('Error optimizing route:', error)
    } finally {
      setOptimizing(false)
    }
  }

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    )
  }

  if (!mapReady) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    )
  }

  return (
    <div className="relative w-full h-screen bg-zinc-100">
      {typeof window !== 'undefined' && (
        <MapContainer
          center={PIRAVOM_CENTER}
          zoom={13}
          style={{ width: '100%', height: '100%' }}
          className="z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Auto-fit map bounds when household signals are present */}
          {householdSignals.length > 0 && (
            <UseMapComponent
              bounds={[
                ...zones.map(z => [z.lat, z.lon] as [number, number]),
                ...householdSignals.map(h => [h.lat, h.lon] as [number, number]),
                workerLocation,
              ]}
            />
          )}

          {route.length > 0 && <RouteLine route={route} routePath={routePath} />}

          {/* Worker starting position */}
          <CircleMarker
            center={workerLocation}
            radius={8}
            pathOptions={{
              color: '#9333ea',
              fillColor: '#9333ea',
              fillOpacity: 0.9,
              weight: 2,
            }}
          >
            <Popup>
              <div className="text-xs">Worker Location (Start)</div>
            </Popup>
          </CircleMarker>

          {/* Route markers */}
          {route.map((zone, index) => {
            const isCompleted = index < currentZoneIndex;
            const isActive = index === currentZoneIndex;
            const isHousehold = !!(zone as RouteZone).is_household_signal;
            const markerColor = isCompleted ? '#94a3b8' : isHousehold ? '#f59e0b' : RISK_COLORS[zone.risk_level];

            return (
              <CircleMarker
                key={zone.id}
                center={[zone.lat, zone.lon]}
                radius={isHousehold ? (isActive ? 14 : 12) : (isActive ? Math.sqrt(zone.fill_percentage) * 3 : Math.sqrt(zone.fill_percentage) * 2.5)}
                pathOptions={{
                  color: isHousehold ? '#d97706' : markerColor,
                  fillColor: markerColor,
                  fillOpacity: isCompleted ? 0.3 : isHousehold ? 0.7 : 0.8,
                  weight: isActive ? 4 : isHousehold ? 3 : 2,
                }}
              >
                <Tooltip permanent direction="top" className={`border-none shadow-sm text-[10px] font-bold px-1.5 py-0.5 rounded opacity-100 ${isHousehold ? 'bg-amber-50 text-amber-800' : 'bg-white/90 text-zinc-800'}`}>
                  {isHousehold ? '🏠 READY' : `${zone.fill_percentage.toFixed(0)}%`}
                </Tooltip>
                <Popup className="w-80">
                  <div className="space-y-2 p-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-block w-6 h-6 rounded-full text-white text-xs flex items-center justify-center font-bold ${isHousehold ? 'bg-amber-500' : 'bg-blue-500'}`}>
                          {index + 1}
                        </span>
                        <h3 className="font-semibold text-sm text-zinc-900">
                          {isHousehold ? `🏠 ${zone.name}` : zone.name}
                        </h3>
                      </div>
                      {isHousehold ? (
                        <p className="text-xs text-amber-600 mt-1 font-medium">Priority Household Pickup</p>
                      ) : (
                        <p className="text-xs text-zinc-500 mt-1">{zone.id}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {isHousehold ? (
                        <div className="bg-amber-50 p-2 rounded col-span-2">
                          <p className="text-amber-700 font-semibold">Ready for Pickup</p>
                          {(zone as RouteZone).waste_types && (zone as RouteZone).waste_types!.length > 0 && (
                            <p className="text-amber-600 mt-1">Types: {(zone as RouteZone).waste_types!.join(', ')}</p>
                          )}
                        </div>
                      ) : (
                        <>
                          <div className="bg-zinc-50 p-2 rounded">
                            <p className="text-zinc-500">Fill Level</p>
                            <p className="font-semibold text-zinc-900">{zone.fill_percentage.toFixed(1)}%</p>
                          </div>
                          <div className="bg-zinc-50 p-2 rounded">
                            <p className="text-zinc-500">Risk</p>
                            <p style={{ color: RISK_COLORS[zone.risk_level] }} className="font-semibold">
                              {zone.risk_level}
                            </p>
                          </div>
                        </>
                      )}
                      <div className="bg-blue-50 p-2 rounded col-span-2">
                        <p className="text-zinc-500">Distance from Previous</p>
                        <p className="font-semibold text-blue-600">{zone.distanceFromPrevious.toFixed(2)} km</p>
                      </div>
                      <div className="bg-blue-50 p-2 rounded col-span-2">
                        <p className="text-zinc-500">Est. Time to Reach</p>
                        <p className="font-semibold text-blue-600">{zone.estimatedTime} min</p>
                      </div>

                      {isActive && (
                        <div className="col-span-2 pt-2 border-t border-zinc-200 mt-2">
                          <Button
                            size="sm"
                            className={`w-full ${isHousehold ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white text-xs`}
                            onClick={() => handleRequestComplete(zone)}
                            disabled={completingZoneId === zone.id}
                          >
                            {completingZoneId === zone.id ? (
                              <Loader2 className="w-3 h-3 animate-spin mr-2" />
                            ) : (
                              <CheckCircle2 className="w-3 h-3 mr-2" />
                            )}
                            {isHousehold ? 'Mark Picked Up' : 'Complete Collection'}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            )
          })}

          {/* Non-route zones (faded) */}
          {zones
            .filter((z) => !route.find((r) => r.id === z.id))
            .map((zone) => (
              <CircleMarker
                key={zone.id}
                center={[zone.lat, zone.lon]}
                radius={Math.sqrt(zone.fill_percentage) * 2}
                pathOptions={{
                  color: RISK_COLORS[zone.risk_level],
                  fillColor: RISK_COLORS[zone.risk_level],
                  fillOpacity: 0.3,
                  weight: 1,
                }}
              >
                <Tooltip permanent direction="top" className="bg-white/70 border-none shadow-sm text-[10px] font-bold px-1.5 py-0.5 rounded text-zinc-600 opacity-80">
                  {zone.fill_percentage.toFixed(0)}%
                </Tooltip>
                <Popup className="w-80">
                  <div className="text-xs text-zinc-500">
                    <p className="font-semibold">{zone.name}</p>
                    <p>Fill: {zone.fill_percentage.toFixed(1)}%</p>
                    <p className="text-zinc-400 mt-1">(Not in optimized route)</p>
                  </div>
                </Popup>
              </CircleMarker>
            ))}

          {/* Household signals NOT in route (pulsing markers) */}
          {householdSignals
            .filter((h) => !route.find((r) => r.id === `household_${h.household_id}` || r.id === h.id))
            .map((signal) => (
              <CircleMarker
                key={signal.id}
                center={[signal.lat, signal.lon]}
                radius={12}
                pathOptions={{
                  color: '#f59e0b',
                  fillColor: '#fbbf24',
                  fillOpacity: 0.6,
                  weight: 3,
                }}
              >
                <Tooltip permanent direction="top" className="bg-amber-50 border-none shadow-sm text-[10px] font-bold px-1.5 py-0.5 rounded text-amber-800 opacity-100">
                  🏠 READY
                </Tooltip>
                <Popup className="w-80">
                  <div className="space-y-2 p-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🏠</span>
                      <h3 className="font-semibold text-sm text-zinc-900">{signal.nickname}</h3>
                    </div>
                    <div className="bg-amber-50 p-2 rounded">
                      <p className="text-xs font-semibold text-amber-700">Ready for Pickup</p>
                      {signal.waste_types && signal.waste_types.length > 0 && (
                        <p className="text-xs text-amber-600 mt-1">Types: {signal.waste_types.join(', ')}</p>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400">(Not yet in optimized route — click Optimize)</p>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
        </MapContainer>
      )}

      {/* Control Panel */}
      <div className="absolute top-4 left-4 z-10 space-y-3 max-w-sm">
        <Card className="bg-white shadow-lg border-zinc-200 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Navigation className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-zinc-900">Route Optimizer</h2>
          </div>

          <Button
            onClick={handleOptimizeRoute}
            disabled={optimizing || zones.length === 0}
            className="w-full mb-4 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {optimizing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Optimizing...
              </>
            ) : (
              <>
                <Navigation className="w-4 h-4 mr-2" />
                Optimize Route
              </>
            )}
          </Button>

          {/* Priority Pickups Badge */}
          {householdSignals.length > 0 && (
            <div className="mb-4 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-lg">🏠</span>
                <div>
                  <p className="font-semibold text-amber-800 text-sm">
                    {householdSignals.length} Priority Pickup{householdSignals.length !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-amber-600">
                    Households marked as ready for collection
                  </p>
                </div>
              </div>
            </div>
          )}

          {routeInfo && (
            <div className="space-y-3 text-xs">
              {routeInfo.householdSignalCount > 0 && (
                <div className="bg-gradient-to-r from-amber-50 to-yellow-50 p-3 rounded border border-amber-200">
                  <div className="flex items-center justify-between">
                    <span className="text-amber-700 font-medium">🏠 Priority Pickups</span>
                    <span className="font-bold text-amber-700">{routeInfo.householdSignalCount}</span>
                  </div>
                </div>
              )}

              <div className="bg-blue-50 p-3 rounded">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600">Total Distance</span>
                  <span className="font-semibold text-blue-600">{routeInfo.totalDistance} km</span>
                </div>
              </div>

              <div className="bg-green-50 p-3 rounded">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600">Est. Total Time</span>
                  <span className="font-semibold text-green-600">~{routeInfo.estimatedTotalTime} min</span>
                </div>
              </div>

              <div className="bg-amber-50 p-3 rounded">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600">Hotspots in Route</span>
                  <span className="font-semibold text-amber-600">{routeInfo.hotspotCount}</span>
                </div>
              </div>

              <div className="bg-zinc-50 p-3 rounded">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600">Zones in Route</span>
                  <span className="font-semibold text-zinc-900">{route.length} / {zones.length + householdSignals.length}</span>
                </div>
              </div>
            </div>
          )}
        </Card>

        {route.length > 0 && (
          <Card className="bg-white shadow-lg border-zinc-200 p-4 max-h-96 overflow-y-auto">
            <h3 className="font-semibold text-sm text-zinc-900 mb-3">Ordered Route</h3>
            <div className="space-y-2">
              {route.map((zone, index) => {
                const isCompleted = index < currentZoneIndex;
                const isActive = index === currentZoneIndex;
                const isHousehold = !!(zone as RouteZone).is_household_signal;
                const bColor = isCompleted ? '#e2e8f0' : isHousehold ? '#f59e0b' : RISK_COLORS[zone.risk_level];

                return (
                  <div key={zone.id} className={`p-2 rounded border-l-4 ${isActive ? 'bg-blue-50/50 shadow-sm' : isHousehold ? 'bg-amber-50/50' : 'bg-zinc-50'} ${isCompleted ? 'opacity-60' : ''}`} style={{ borderColor: bColor }}>
                    <div className="flex items-start gap-2">
                      <span className={`inline-block w-5 h-5 rounded-full text-white text-xs flex items-center justify-center font-bold flex-shrink-0 mt-0.5 ${isCompleted ? 'bg-zinc-400' : isHousehold ? 'bg-amber-500' : 'bg-blue-500'}`}>
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-xs truncate ${isCompleted ? 'text-zinc-500 line-through' : 'text-zinc-900'}`}>
                          {isHousehold ? '🏠 ' : ''}{zone.name}
                        </p>
                        <div className="flex gap-2 mt-1 text-xs text-zinc-500">
                          <span>📍 {zone.distanceFromPrevious.toFixed(2)} km</span>
                          <span>⏱️ {zone.estimatedTime} min</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          {isHousehold ? (
                            <span className="inline-block px-2 py-0.5 rounded text-white text-[10px] font-semibold" style={{ backgroundColor: isCompleted ? '#94a3b8' : '#f59e0b' }}>
                              {isCompleted ? 'COLLECTED' : '🏠 READY FOR PICKUP'}
                            </span>
                          ) : (
                            <span
                              className="inline-block px-2 py-0.5 rounded text-white text-[10px] font-semibold"
                              style={{ backgroundColor: isCompleted ? '#94a3b8' : RISK_COLORS[zone.risk_level] }}
                            >
                              {isCompleted ? 'COLLECTED' : `${zone.fill_percentage.toFixed(0)}% • ${zone.risk_level}`}
                            </span>
                          )}

                          {isActive && (
                            <Button
                              size="sm"
                              variant="default"
                              className={`${isHousehold ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white h-6 text-[10px] px-2`}
                              onClick={() => handleRequestComplete(zone)}
                              disabled={completingZoneId === zone.id}
                            >
                              {completingZoneId === zone.id ? <Loader2 className="w-3 h-3 animate-spin" /> : isHousehold ? 'Picked Up' : 'Complete'}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )}
      </div>
      {/* Pickup Confirmation Modal */}
      {confirmingZone && (
        <PickupConfirmationModal
          open={confirmModalOpen}
          onOpenChange={setConfirmModalOpen}
          zoneName={confirmingZone.name}
          zoneId={confirmingZone.id}
          isHousehold={!!confirmingZone.is_household_signal}
          householdId={confirmingZone.household_id}
          onConfirmed={handlePickupConfirmed}
          onDeclined={handlePickupDeclined}
        />
      )}
    </div>
  )
}
