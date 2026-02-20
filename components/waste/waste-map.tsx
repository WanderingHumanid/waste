'use client'

import React, { useEffect, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { ZoneState } from '@/lib/waste_engine'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Loader2, Droplet, AlertTriangle, Zap } from 'lucide-react'
import 'leaflet/dist/leaflet.css'

// Custom component to render labels
function ZoneLabels({ zones }: { zones: ZoneState[] }) {
  const map = useMap()
  
  useEffect(() => {
    const markers: L.Marker[] = []
    
    zones.forEach((zone) => {
      const marker = L.marker([zone.lat, zone.lon], {
        icon: L.divIcon({
          html: `<div style="background: white; padding: 4px 8px; border-radius: 4px; border: 2px solid #333; font-size: 11px; font-weight: 600; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.2); color: #333;">${zone.name.substring(0, 20)}</div>`,
          iconSize: undefined,
          className: 'zone-label-marker',
        }),
      }).addTo(map)
      markers.push(marker)
    })
    
    return () => {
      markers.forEach((m) => m.remove())
    }
  }, [zones, map])
  
  return null
}

const RISK_COLORS = {
  LOW: '#22c55e',
  MEDIUM: '#eab308',
  HIGH: '#f97316',
  CRITICAL: '#ef4444',
}

const PIRAVOM_CENTER: [number, number] = [9.8667, 76.5000]

export function WasteMap() {
  const [zones, setZones] = useState<ZoneState[]>([])
  const [hotspots, setHotspots] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [collectingZone, setCollectingZone] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [zonesRes, hotspotsRes] = await Promise.all([
          fetch('/api/waste/zones'),
          fetch('/api/waste/hotspots'),
        ])

        if (zonesRes.ok) {
          const zonesData = await zonesRes.json()
          setZones(zonesData.zones)
        }

        if (hotspotsRes.ok) {
          const hotspotsData = await hotspotsRes.json()
          setHotspots(hotspotsData.hotspots.map((z: ZoneState) => z.id))
        }

        setLoading(false)
      } catch (error) {
        console.error('Error fetching data:', error)
        setLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 5000)

    return () => clearInterval(interval)
  }, [])

  const handleCollect = async (zoneId: string) => {
    setCollectingZone(zoneId)
    try {
      const res = await fetch(`/api/waste/collect/${zoneId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 150 }),
      })

      if (res.ok) {
        const data = await res.json()
        setZones(
          zones.map((z) =>
            z.id === zoneId
              ? {
                  ...z,
                  current_fill: data.zone.current_fill,
                  fill_percentage: data.zone.fill_percentage,
                  risk_level: data.zone.risk_level,
                }
              : z
          )
        )
      }
    } catch (error) {
      console.error('Error collecting waste:', error)
    } finally {
      setCollectingZone(null)
    }
  }

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    )
  }

  return (
    <div className="relative w-full h-screen bg-zinc-100">
      <MapContainer
        center={PIRAVOM_CENTER}
        zoom={12}
        style={{ width: '100%', height: '100%' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <ZoneLabels zones={zones} />

        {zones.map((zone) => {
          const isHotspot = hotspots.includes(zone.id)
          const radius = 400 + (isHotspot ? 200 : 0)
          const opacity = isHotspot ? 0.8 : 0.6

          return (
            <CircleMarker
              key={zone.id}
              center={[zone.lat, zone.lon]}
              radius={Math.sqrt(zone.fill_percentage) * 2}
              pathOptions={{
                color: RISK_COLORS[zone.risk_level],
                fillColor: RISK_COLORS[zone.risk_level],
                fillOpacity: opacity,
                weight: isHotspot ? 3 : 2,
              }}
              className={isHotspot ? 'animate-pulse' : ''}
            >
              <Popup className="w-80">
                <div className="space-y-3 p-2">
                  <div>
                    <h3 className="font-semibold text-sm text-zinc-900">
                      {zone.name}
                    </h3>
                    <p className="text-xs text-zinc-500">{zone.id}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-zinc-50 p-2 rounded">
                      <p className="text-zinc-500">Fill Level</p>
                      <p className="font-semibold text-zinc-900">
                        {zone.fill_percentage.toFixed(1)}%
                      </p>
                    </div>
                    <div className="bg-zinc-50 p-2 rounded">
                      <p className="text-zinc-500">Risk</p>
                      <p
                        className="font-semibold"
                        style={{ color: RISK_COLORS[zone.risk_level] }}
                      >
                        {zone.risk_level}
                      </p>
                    </div>
                    <div className="bg-zinc-50 p-2 rounded col-span-2">
                      <p className="text-zinc-500">Predicted Overflow</p>
                      <p className="font-semibold text-zinc-900">
                        {zone.predicted_overflow_minutes
                          ? `${zone.predicted_overflow_minutes} min`
                          : 'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-zinc-200">
                    <Button
                      size="sm"
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                      onClick={() => handleCollect(zone.id)}
                      disabled={collectingZone === zone.id}
                    >
                      {collectingZone === zone.id ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-2" />
                      ) : (
                        <Droplet className="w-3 h-3 mr-2" />
                      )}
                      Collect Waste
                    </Button>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          )
        })}
      </MapContainer>

      {/* Stats Panel */}
      <div className="absolute top-4 left-4 z-10 space-y-2 max-w-xs">
        <Card className="bg-white shadow-lg border-zinc-200 p-4">
          <h2 className="font-bold text-sm text-zinc-900 mb-3">
            Waste Dashboard
          </h2>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-zinc-600">Total Zones</span>
              <span className="font-semibold text-zinc-900">{zones.length}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-zinc-600">Critical</span>
              <span className="font-semibold text-red-600">
                {zones.filter((z) => z.risk_level === 'CRITICAL').length}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-zinc-600">High Risk</span>
              <span className="font-semibold text-orange-600">
                {zones.filter((z) => z.risk_level === 'HIGH').length}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-zinc-600">Avg Fill</span>
              <span className="font-semibold text-zinc-900">
                {(
                  zones.reduce((sum, z) => sum + z.fill_percentage, 0) /
                  zones.length
                ).toFixed(1)}
                %
              </span>
            </div>
          </div>
        </Card>

        {hotspots.length > 0 && (
          <Card className="bg-white shadow-lg border-amber-200 border p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <h3 className="font-semibold text-xs text-amber-900">
                Hotspots
              </h3>
            </div>
            <div className="space-y-1 text-xs">
              {hotspots.slice(0, 3).map((zoneId) => {
                const zone = zones.find((z) => z.id === zoneId)
                return (
                  <div key={zoneId} className="text-zinc-600">
                    <p className="truncate">{zone?.name}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Score:</span>
                      <span className="font-semibold text-amber-600">
                        {Math.round(zone?.hotspot_score || 0)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )}
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 z-10">
        <Card className="bg-white shadow-lg border-zinc-200 p-3">
          <h3 className="font-semibold text-xs text-zinc-900 mb-2">Risk Levels</h3>
          <div className="space-y-1.5 text-xs">
            {(Object.entries(RISK_COLORS) as const).map(([level, color]) => (
              <div key={level} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-zinc-600">{level}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
