import { NextRequest, NextResponse } from 'next/server'
import { getWasteEngine, ZoneState } from '@/lib/waste_engine'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

interface RouteRequest {
  workerLat: number
  workerLng: number
  zoneIds?: string[]
}

// Extended zone state that can include household signal info
interface ExtendedZoneState extends ZoneState {
  is_household_signal?: boolean
  household_id?: string
  nickname?: string
  ward_number?: number | null
  waste_types?: string[]
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
// Household signals get a massive boost (2x multiplier)
function calculateUrgency(zone: ExtendedZoneState): number {
  // Household signals: user explicitly said they're ready → highest priority
  if (zone.is_household_signal) {
    return 2.0 // Maximum urgency, higher than any bin zone can reach (max 1.0)
  }

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
  zones: ExtendedZoneState[]
): ExtendedZoneState[] {
  if (zones.length === 0) return []
  if (zones.length === 1) return zones

  const visited = new Set<string>()
  const route: ExtendedZoneState[] = []

  let currentLat = startLat
  let currentLng = startLng
  let remaining = [...zones]

  while (remaining.length > 0) {
    let bestZone: ExtendedZoneState | null = null
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

// Parse PostGIS location from various formats
function parseLocation(location: unknown): { lat: number; lng: number } | null {
  if (!location) return null

  if (typeof location === 'string') {
    const wktMatch = location.match(/POINT\s*\(\s*([\d.-]+)\s+([\d.-]+)\s*\)/i)
    if (wktMatch) {
      return { lng: parseFloat(wktMatch[1]), lat: parseFloat(wktMatch[2]) }
    }

    if (location.startsWith('01') && location.length >= 50) {
      try {
        const hexToDouble = (hex: string) => {
          const bytes = new Uint8Array(8)
          for (let i = 0; i < 8; i++) {
            bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
          }
          const buffer = bytes.buffer
          const view = new DataView(buffer)
          return view.getFloat64(0, true)
        }
        const xHex = location.substring(18, 34)
        const yHex = location.substring(34, 50)
        return { lng: hexToDouble(xHex), lat: hexToDouble(yHex) }
      } catch {
        return null
      }
    }
  }

  if (typeof location === 'object' && location !== null) {
    const loc = location as Record<string, unknown>
    if (loc.coordinates && Array.isArray(loc.coordinates)) {
      return { lng: loc.coordinates[0] as number, lat: loc.coordinates[1] as number }
    }
    if ('x' in loc && 'y' in loc) {
      return { lng: loc.x as number, lat: loc.y as number }
    }
  }

  return null
}

// Fetch waste-ready households from Supabase
async function fetchReadyHouseholds(): Promise<ExtendedZoneState[]> {
  try {
    const supabase = await createClient()

    const { data: households, error } = await supabase
      .from('households')
      .select(`
        id,
        user_id,
        nickname,
        ward_number,
        waste_ready,
        location,
        signals (
          id,
          waste_types,
          status
        )
      `)
      .eq('waste_ready', true)

    if (error) {
      console.error('Error fetching ready households:', error)
      return []
    }

    const now = Date.now()
    const signals: ExtendedZoneState[] = []

    for (const household of households || []) {
      const coords = parseLocation(household.location)
      if (!coords || (coords.lat === 0 && coords.lng === 0)) continue

      const activeSignal = Array.isArray(household.signals)
        ? household.signals.find((s: Record<string, unknown>) =>
          s.status === 'pending' || s.status === 'acknowledged'
        )
        : null

      signals.push({
        id: `household_${household.id}`,
        name: household.nickname || 'Household Pickup',
        lat: coords.lat,
        lon: coords.lng,
        fill_percentage: 100,
        risk_level: 'CRITICAL',
        hotspot_score: 99999,
        predicted_overflow_minutes: 0,
        bin_capacity: 100,
        generation_rate: 0,
        last_collection_time: now - 180 * 60 * 1000,
        current_fill: 100,
        is_household_signal: true,
        household_id: household.id,
        nickname: household.nickname || 'Household',
        ward_number: household.ward_number,
        waste_types: activeSignal?.waste_types || [],
      })
    }

    return signals
  } catch (error) {
    console.error('Error in fetchReadyHouseholds:', error)
    return []
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: RouteRequest = await request.json()
    const { workerLat, workerLng, zoneIds } = body

    const engine = getWasteEngine()
    engine.tick()

    const allZones = engine.getZones()

    // Filter zones if specific IDs provided, otherwise use all
    const engineZones: ExtendedZoneState[] = zoneIds
      ? allZones.filter((z) => zoneIds.includes(z.id))
      : allZones

    // Fetch waste-ready households from Supabase
    const householdSignals = await fetchReadyHouseholds()
    const householdSignalCount = householdSignals.length

    // Merge engine zones and household signals
    const allPoints: ExtendedZoneState[] = [...householdSignals, ...engineZones]

    // Get top urgent zones (hotspots)
    const hotspots = engine.getHotspots(5)
    const hotspotIds = new Set(hotspots.map((h) => h.id))

    // Sort: household signals first, then hotspots, then others by urgency
    const prioritized = allPoints.sort((a, b) => {
      const aIsHousehold = !!(a as ExtendedZoneState).is_household_signal
      const bIsHousehold = !!(b as ExtendedZoneState).is_household_signal

      // Household signals always come first
      if (aIsHousehold !== bIsHousehold) {
        return aIsHousehold ? -1 : 1
      }

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
      householdSignalCount,
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
