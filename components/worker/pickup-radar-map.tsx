'use client'

import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { RoutingService } from '@/lib/services/routing-service'
import { MapPin } from 'lucide-react'

interface Household {
  id: string
  user_id: string
  nickname: string
  manual_address: string | null
  geocoded_address: string | null
  ward_number: number
  lat: number
  lng: number
  waste_ready: boolean
  distance_m: number
  profile?: {
    full_name: string | null
    phone: string | null
  }
}

interface WorkerPosition {
  lat: number
  lng: number
  accuracy: number
}

interface PickupRadarMapProps {
  workerPosition: WorkerPosition | null
  households: Household[]
  selectedHousehold: Household | null
  onSelectHousehold: (household: Household) => void
}

// Custom pulsing icon for waste-ready households
const createPulsingIcon = (isSelected: boolean) => {
  const size = isSelected ? 32 : 24
  return L.divIcon({
    className: 'pulsing-marker',
    html: `
      <div class="relative">
        <div class="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-75" style="width: ${size}px; height: ${size}px;"></div>
        <div class="relative rounded-full bg-green-500 border-2 border-white shadow-lg flex items-center justify-center" style="width: ${size}px; height: ${size}px;">
          <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

// Worker position icon
const workerIcon = L.divIcon({
  className: 'worker-marker',
  html: `
    <div class="relative">
      <div class="absolute inset-0 rounded-full bg-amber-500 animate-pulse opacity-50" style="width: 40px; height: 40px;"></div>
      <div class="relative rounded-full bg-amber-500 border-3 border-white shadow-lg flex items-center justify-center" style="width: 40px; height: 40px;">
        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      </div>
    </div>
  `,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
})

export default function PickupRadarMap({
  workerPosition,
  households,
  selectedHousehold,
  onSelectHousehold,
}: PickupRadarMapProps) {
  const mapRef = useRef<L.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const workerMarkerRef = useRef<L.Marker | null>(null)
  const householdMarkersRef = useRef<Map<string, L.Marker>>(new Map())
  const rangeCircleRef = useRef<L.Circle | null>(null)
  const routeLayerRef = useRef<L.Polyline | null>(null)
  const [activeRoute, setActiveRoute] = useState<any>(null)

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    // Default to Kerala center if no position
    const defaultCenter: [number, number] = [9.9312, 76.2673] // Kochi

    mapRef.current = L.map(mapContainerRef.current, {
      center: workerPosition ? [workerPosition.lat, workerPosition.lng] : defaultCenter,
      zoom: 15,
      zoomControl: false,
    })

    // Add dark-themed tile layer for outdoor visibility
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19,
    }).addTo(mapRef.current)

    // Add zoom control to top-right
    L.control.zoom({ position: 'topright' }).addTo(mapRef.current)

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  // Update worker position marker
  useEffect(() => {
    if (!mapRef.current || !workerPosition) return

    if (workerMarkerRef.current) {
      workerMarkerRef.current.setLatLng([workerPosition.lat, workerPosition.lng])
    } else {
      workerMarkerRef.current = L.marker([workerPosition.lat, workerPosition.lng], {
        icon: workerIcon,
        zIndexOffset: 1000,
      }).addTo(mapRef.current)

      workerMarkerRef.current.bindTooltip('You are here', {
        permanent: false,
        direction: 'top',
        className: 'bg-amber-900 text-amber-100 border-amber-700',
      })
    }

    // Update or create 50m range circle
    if (rangeCircleRef.current) {
      rangeCircleRef.current.setLatLng([workerPosition.lat, workerPosition.lng])
    } else {
      rangeCircleRef.current = L.circle([workerPosition.lat, workerPosition.lng], {
        radius: 50,
        color: '#f59e0b',
        fillColor: '#f59e0b',
        fillOpacity: 0.1,
        weight: 2,
        dashArray: '5, 5',
      }).addTo(mapRef.current)
    }

    // Center map on worker
    mapRef.current.setView([workerPosition.lat, workerPosition.lng], mapRef.current.getZoom())
  }, [workerPosition])

  // Update household markers
  useEffect(() => {
    if (!mapRef.current) return

    const currentIds = new Set(households.map(h => h.id))

    // Remove markers for households no longer in list
    householdMarkersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove()
        householdMarkersRef.current.delete(id)
      }
    })

    // Add/update markers
    households.forEach((household) => {
      const isSelected = selectedHousehold?.id === household.id
      const existingMarker = householdMarkersRef.current.get(household.id)

      if (existingMarker) {
        // Update icon if selection changed
        existingMarker.setIcon(createPulsingIcon(isSelected))
      } else {
        // Create new marker
        const marker = L.marker([household.lat, household.lng], {
          icon: createPulsingIcon(isSelected),
        }).addTo(mapRef.current!)

        marker.bindTooltip(
          `<strong>${household.nickname || 'Household'}</strong><br/>${Math.round(household.distance_m)}m away`,
          {
            permanent: false,
            direction: 'top',
          }
        )

        marker.on('click', () => {
          onSelectHousehold(household)
        })

        householdMarkersRef.current.set(household.id, marker)
      }
    })
  }, [households, selectedHousehold, onSelectHousehold])

  // Pan to selected household
  useEffect(() => {
    if (!mapRef.current || !selectedHousehold) return

    mapRef.current.panTo([selectedHousehold.lat, selectedHousehold.lng], {
      animate: true,
      duration: 0.5,
    })

    // Update marker icon
    const marker = householdMarkersRef.current.get(selectedHousehold.id)
    if (marker) {
      marker.setIcon(createPulsingIcon(true))
    }
  }, [selectedHousehold])

  // Fetch and update route
  useEffect(() => {
    async function updateRoute() {
      if (!mapRef.current || !workerPosition) return

      let routePoints = [{ lat: workerPosition.lat, lng: workerPosition.lng }]

      if (selectedHousehold) {
        // Simple direct road route to selected
        routePoints.push({ lat: selectedHousehold.lat, lng: selectedHousehold.lng })
      } else if (households.length > 0) {
        // Optimize route through top 5 nearest/high-priority households
        const targets = households
          .slice(0, 5)
          .map(h => ({ lat: h.lat, lng: h.lng }))
        routePoints.push(...targets)
      }

      if (routePoints.length < 2) {
        if (routeLayerRef.current) routeLayerRef.current.remove()
        routeLayerRef.current = null
        return
      }

      const routeData = selectedHousehold
        ? await RoutingService.getRoute(routePoints)
        : await RoutingService.optimizeRoute(routePoints)

      if (routeData && routeData.geometry) {
        // Convert GeoJSON coordinates (lng, lat) to Leaflet (lat, lng)
        const latLngs = routeData.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]])

        if (routeLayerRef.current) {
          routeLayerRef.current.setLatLngs(latLngs)
        } else {
          routeLayerRef.current = L.polyline(latLngs, {
            color: '#10b981',
            weight: 5,
            opacity: 0.7,
            lineJoin: 'round',
            dashArray: selectedHousehold ? undefined : '10, 10',
          }).addTo(mapRef.current)
        }

        setActiveRoute(routeData)
      }
    }

    updateRoute()
  }, [workerPosition, households, selectedHousehold])

  return (
    <div className="relative">
      <div
        ref={mapContainerRef}
        className="h-[400px] rounded-lg overflow-hidden"
        style={{ background: '#1a1a2e' }}
      />

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-amber-900/90 backdrop-blur rounded-lg p-3 text-xs text-amber-200 space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span>Your Position</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
          <span>Waste Ready</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full border-2 border-amber-500 border-dashed" />
          <span>50m Range</span>
        </div>
      </div>

      {/* GPS Missing Overlay */}
      {!workerPosition && (
        <div className="absolute inset-0 bg-amber-900/40 backdrop-blur-[2px] z-[1000] flex items-center justify-center p-6 text-center">
          <div className="bg-amber-900/95 p-6 rounded-xl border border-amber-500/50 shadow-2xl max-w-xs">
            <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-6 h-6 text-amber-500" />
            </div>
            <p className="text-amber-100 font-bold mb-2">Waiting for GPS...</p>
            <p className="text-amber-300/70 text-xs mb-4 leading-relaxed">
              We need your coordinates to show nearby waste signals. Please ensure location permissions are enabled.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
