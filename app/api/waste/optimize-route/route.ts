import { NextRequest, NextResponse } from 'next/server'
import { getWasteEngine, ZoneState } from '@/lib/waste_engine'

export const runtime = 'nodejs'

interface RouteRequest {
  workerLat: number
  workerLng: number
  zoneIds?: string[]
}

// Calculate distance between two coordinates using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Calculate urgency score (higher = more urgent)
function calculateUrgency(zone: ZoneState): number {
  // Urgency based on fill percentage and time since collection
  const fillUrgency = zone.fill_percentage / 100 // 0-1
  const timeFactor = Math.min(zone.predicted_overflow_minutes || 1440, 1440) / 1440 // Normalize to max 24 hours
  
  // Higher score = more urgent. Zones nearing capacity get higher priority
  return fillUrgency * 0.7 + (1 - timeFactor) * 0.3
}

// Nearest neighbor with priority consideration
function optimizeRoute(
  startLat: number,
  startLng: number,
  zones: ZoneState[]
): ZoneState[] {
  if (zones.length === 0) return []
  if (zones.length === 1) return zones

  const visited = new Set<string>()
  const route: ZoneState[] = []
  
  let currentLat = startLat
  let currentLng = startLng
  let remaining = [...zones]

  while (remaining.length > 0) {
    let bestZone: ZoneState | null = null
    let bestScore = -Infinity
    let bestDistance = Infinity

    for (const zone of remaining) {
      const distance = calculateDistance(currentLat, currentLng, zone.lat, zone.lon)
      
      // Score combines urgency and proximity
      // Urgency gets 60% weight, proximity gets 40% weight
      const urgency = calculateUrgency(zone)
      const proximityScore = 1 / (1 + distance) // Closer = higher score
      
      const score = urgency * 0.6 + proximityScore * 0.4
      
      if (score > bestScore || (score === bestScore && distance < bestDistance)) {
        bestScore = score
        bestZone = zone
        bestDistance = distance
      }
    }

    if (bestZone) {
      route.push(bestZone)
      visited.add(bestZone.id)
      currentLat = bestZone.lat
      currentLng = bestZone.lon
      remaining = remaining.filter((z) => z.id !== bestZone.id)
    } else {
      break
    }
  }

  return route
}

export async function POST(request: NextRequest) {
  try {
    const body: RouteRequest = await request.json()
    const { workerLat, workerLng, zoneIds } = body

    const engine = getWasteEngine()
    engine.tick()

    const allZones = engine.getZones()

    // Filter zones if specific IDs provided, otherwise use all
    const zones = zoneIds
      ? allZones.filter((z) => zoneIds.includes(z.id))
      : allZones

    // Get top urgent zones (hotspots)
    const hotspots = engine.getHotspots(5)
    const hotspotIds = new Set(hotspots.map((h) => h.id))

    // Sort zones: hotspots first by urgency, then others by proximity
    const prioritized = zones.sort((a, b) => {
      const aIsHotspot = hotspotIds.has(a.id)
      const bIsHotspot = hotspotIds.has(b.id)

      if (aIsHotspot !== bIsHotspot) {
        return aIsHotspot ? -1 : 1
      }

      return calculateUrgency(b) - calculateUrgency(a)
    })

    // Optimize route
    const optimizedRoute = optimizeRoute(workerLat, workerLng, prioritized)

    // Calculate total distance and estimated time
    let totalDistance = 0
    let currentLat = workerLat
    let currentLng = workerLng

    const routeWithDistances = optimizedRoute.map((zone) => {
      const distance = calculateDistance(currentLat, currentLng, zone.lat, zone.lon)
      totalDistance += distance
      currentLat = zone.lat
      currentLng = zone.lon

      return {
        ...zone,
        distanceFromPrevious: distance,
        estimatedTime: Math.round(distance * 2.5), // ~2.5 min per km
      }
    })

    return NextResponse.json({
      success: true,
      route: routeWithDistances,
      totalDistance: Math.round(totalDistance * 10) / 10,
      estimatedTotalTime: Math.round(totalDistance * 2.5),
      hotspotCount: hotspotIds.size,
      timestamp: Date.now(),
    })
  } catch (error) {
    console.error('Error optimizing route:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to optimize route' },
      { status: 500 }
    )
  }
}
