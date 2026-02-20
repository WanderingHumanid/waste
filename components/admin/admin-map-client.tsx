'use client'

import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

interface MapPoint {
  id: string
  lat: number
  lng: number
}

interface SignalPoint extends MapPoint {
  intensity: number
  status: string
  ward: number | null
  wasteTypes: string[]
}

interface HouseholdPoint extends MapPoint {
  wasteReady: boolean
  ward: number | null
}

interface PredictionPoint extends MapPoint {
  intensity: number
  predictedVolume: number
  confidence: number
  peakHour: string
}

interface WorkerPoint {
  id: string
  name: string
  ward: number | null
  district: string | null
}

export interface AdminMapClientProps {
  center: { lat: number; lng: number }
  layers: {
    signals: SignalPoint[]
    households: HouseholdPoint[]
    mlPredictions: PredictionPoint[]
    workers: WorkerPoint[]
  }
  activeLayers: Set<string>
}

// Component to smoothly pan map when center changes
function MapCenterController({ center }: { center: { lat: number; lng: number } }) {
  const map = useMap()
  useEffect(() => {
    map.setView([center.lat, center.lng], map.getZoom())
  }, [center.lat, center.lng])
  return null
}

export default function AdminMapClient({ center, layers, activeLayers }: AdminMapClientProps) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={14}
      style={{ height: '100%', width: '100%', background: '#0f0f11' }}
      zoomControl={true}
    >
      {/* Dark Basemap — CartoDB DarkMatter */}
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        maxZoom={20}
        subdomains="abcd"
      />

      <MapCenterController center={center} />

      {/* LAYER: Household markers */}
      {activeLayers.has('households') &&
        layers.households.map((h) => (
          <CircleMarker
            key={h.id}
            center={[h.lat, h.lng]}
            radius={h.wasteReady ? 8 : 5}
            pathOptions={{
              fillColor: h.wasteReady ? '#10b981' : '#38bdf8',
              fillOpacity: h.wasteReady ? 0.85 : 0.5,
              color: h.wasteReady ? '#047857' : '#0284c7',
              weight: 1.5,
            }}
          >
            <Popup className="admin-popup">
              <div className="text-xs space-y-0.5 min-w-[140px]">
                <p className="font-semibold text-zinc-800">
                  {h.wasteReady ? '🟢 Waste Ready' : 'Household'}
                </p>
                {h.ward && <p className="text-zinc-500">Ward {h.ward}</p>}
                <p className="text-zinc-400 font-mono text-[10px]">
                  {h.lat.toFixed(5)}, {h.lng.toFixed(5)}
                </p>
              </div>
            </Popup>
          </CircleMarker>
        ))}

      {/* LAYER: Live signal heatmap */}
      {activeLayers.has('signals') &&
        layers.signals.map((s) => {
          const isPending = s.status === 'pending'
          return (
            <CircleMarker
              key={s.id}
              center={[s.lat, s.lng]}
              radius={10 + s.intensity * 8}
              pathOptions={{
                fillColor: isPending ? '#f59e0b' : '#fde68a',
                fillOpacity: 0.6 + s.intensity * 0.25,
                color: isPending ? '#d97706' : '#fbbf24',
                weight: 1.5,
              }}
            >
              <Popup className="admin-popup">
                <div className="text-xs space-y-0.5 min-w-[160px]">
                  <p className="font-semibold text-zinc-800 capitalize">
                    🔔 {s.status} Signal
                  </p>
                  {s.ward && <p className="text-zinc-500">Ward {s.ward}</p>}
                  {s.wasteTypes?.length > 0 && (
                    <p className="text-zinc-500">
                      Types: {s.wasteTypes.join(', ')}
                    </p>
                  )}
                  <p className="text-zinc-400 font-mono text-[10px]">
                    {s.lat.toFixed(5)}, {s.lng.toFixed(5)}
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          )
        })}

      {/* LAYER: ML Prediction hotspots — Deep Red */}
      {activeLayers.has('mlPredictions') &&
        layers.mlPredictions.map((p) => (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={14 + p.intensity * 18}
            pathOptions={{
              fillColor: '#dc2626',
              fillOpacity: 0.2 + p.intensity * 0.35,
              color: '#991b1b',
              weight: 1,
              dashArray: '4 2',
            }}
          >
            <Popup className="admin-popup">
              <div className="text-xs space-y-0.5 min-w-[160px]">
                <p className="font-semibold text-rose-700">🔴 ML Prediction</p>
                <p className="text-zinc-700 font-medium">{p.predictedVolume} kg expected</p>
                <p className="text-zinc-500">Peak: {p.peakHour}</p>
                <p className="text-zinc-500">Confidence: {p.confidence}%</p>
                <div className="mt-1 h-1.5 rounded bg-zinc-100">
                  <div
                    className="h-1.5 rounded bg-rose-500"
                    style={{ width: `${p.intensity * 100}%` }}
                  />
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
    </MapContainer>
  )
}
