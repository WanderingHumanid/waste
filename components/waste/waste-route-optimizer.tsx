'use client'

import React, { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { ZoneState } from '@/lib/waste_engine'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Loader2, Navigation, Clock, MapPin, AlertCircle } from 'lucide-react'
import 'leaflet/dist/leaflet.css'

// Dynamically import Leaflet components to avoid SSR issues
const MapContainer = dynamic(() => import('react-leaflet').then((mod) => mod.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then((mod) => mod.TileLayer), { ssr: false })
const CircleMarker = dynamic(() => import('react-leaflet').then((mod) => mod.CircleMarker), { ssr: false })
const Popup = dynamic(() => import('react-leaflet').then((mod) => mod.Popup), { ssr: false })
const Polyline = dynamic(() => import('react-leaflet').then((mod) => mod.Polyline), { ssr: false })

const RISK_COLORS = {
  LOW: '#22c55e',
  MEDIUM: '#eab308',
  HIGH: '#f97316',
  CRITICAL: '#ef4444',
}

const PIRAVOM_CENTER: [number, number] = [9.8667, 76.5000]

interface RouteZone extends ZoneState {
  distanceFromPrevious: number
  estimatedTime: number
}

interface RouteOptimizationResult {
  success: boolean
  route: RouteZone[]
  totalDistance: number
  estimatedTotalTime: number
  hotspotCount: number
}

// Component to render route line
function RouteLine({ route }: { route: RouteZone[] }) {
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

export function WasteRouteOptimizer() {
  const [zones, setZones] = useState<ZoneState[]>([])
  const [route, setRoute] = useState<RouteZone[]>([])
  const [loading, setLoading] = useState(true)
  const [mapReady, setMapReady] = useState(false)
  const [optimizing, setOptimizing] = useState(false)
  const [workerLocation, setWorkerLocation] = useState<[number, number]>(PIRAVOM_CENTER)
  const [routeInfo, setRouteInfo] = useState<RouteOptimizationResult | null>(null)

  useEffect(() => {
    setMapReady(true)
    const fetchZones = async () => {
      try {
        const res = await fetch('/api/waste/zones')
        if (res.ok) {
          const data = await res.json()
          setZones(data.zones)
        }
        setLoading(false)
      } catch (error) {
        console.error('Error fetching zones:', error)
        setLoading(false)
      }
    }

    fetchZones()
    const interval = setInterval(fetchZones, 10000)
    return () => clearInterval(interval)
  }, [])

  const handleOptimizeRoute = async () => {
    setOptimizing(true)
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

        {route.length > 0 && <RouteLine route={route} />}

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
        {route.map((zone, index) => (
          <CircleMarker
            key={zone.id}
            center={[zone.lat, zone.lon]}
            radius={Math.sqrt(zone.fill_percentage) * 2.5}
            pathOptions={{
              color: RISK_COLORS[zone.risk_level],
              fillColor: RISK_COLORS[zone.risk_level],
              fillOpacity: 0.8,
              weight: 2,
            }}
          >
            <Popup className="w-80">
              <div className="space-y-2 p-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-bold">
                      {index + 1}
                    </span>
                    <h3 className="font-semibold text-sm text-zinc-900">{zone.name}</h3>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">{zone.id}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
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
                  <div className="bg-blue-50 p-2 rounded col-span-2">
                    <p className="text-zinc-500">Distance from Previous</p>
                    <p className="font-semibold text-blue-600">{zone.distanceFromPrevious.toFixed(2)} km</p>
                  </div>
                  <div className="bg-blue-50 p-2 rounded col-span-2">
                    <p className="text-zinc-500">Est. Time to Reach</p>
                    <p className="font-semibold text-blue-600">{zone.estimatedTime} min</p>
                  </div>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}

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
              <Popup className="w-80">
                <div className="text-xs text-zinc-500">
                  <p className="font-semibold">{zone.name}</p>
                  <p>Fill: {zone.fill_percentage.toFixed(1)}%</p>
                  <p className="text-zinc-400 mt-1">(Not in optimized route)</p>
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

          {routeInfo && (
            <div className="space-y-3 text-xs">
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
                  <span className="font-semibold text-zinc-900">{route.length} / {zones.length}</span>
                </div>
              </div>
            </div>
          )}
        </Card>

        {route.length > 0 && (
          <Card className="bg-white shadow-lg border-zinc-200 p-4 max-h-96 overflow-y-auto">
            <h3 className="font-semibold text-sm text-zinc-900 mb-3">Ordered Route</h3>
            <div className="space-y-2">
              {route.map((zone, index) => (
                <div key={zone.id} className="bg-zinc-50 p-2 rounded border-l-4" style={{ borderColor: RISK_COLORS[zone.risk_level] }}>
                  <div className="flex items-start gap-2">
                    <span className="inline-block w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-bold flex-shrink-0 mt-0.5">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-xs text-zinc-900 truncate">{zone.name}</p>
                      <div className="flex gap-2 mt-1 text-xs text-zinc-500">
                        <span>📍 {zone.distanceFromPrevious.toFixed(2)} km</span>
                        <span>⏱️ {zone.estimatedTime} min</span>
                      </div>
                      <div className="mt-1">
                        <span
                          className="inline-block px-2 py-0.5 rounded text-white text-[10px] font-semibold"
                          style={{ backgroundColor: RISK_COLORS[zone.risk_level] }}
                        >
                          {zone.fill_percentage.toFixed(0)}% • {zone.risk_level}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
