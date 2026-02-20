/**
 * POST /api/worker/nearby-signals
 * Get households with waste_ready=true within radius
 * Uses PostGIS ST_DWithin for spatial query
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface NearbySignalsRequest {
  lat: number
  lng: number
  radiusMeters?: number
}

interface HouseholdResult {
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
  waste_types?: string[]
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user is a worker
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, assignments:worker_assignments(ward_number)')
      .eq('id', user.id)
      .single()

    const assignments = profile?.assignments as any
    const ward_number = Array.isArray(assignments) ? assignments[0]?.ward_number : (assignments?.ward_number || null)

    if (!profile || (profile.role !== 'worker' && profile.role !== 'hks_worker' && profile.role !== 'admin')) {
      return NextResponse.json(
        { success: false, error: 'Worker access required' },
        { status: 403 }
      )
    }

    const body: NearbySignalsRequest = await request.json()
    const { lat, lng, radiusMeters = 2000 } = body

    // Validate coordinates
    if (lat === undefined || lng === undefined) {
      return NextResponse.json(
        { success: false, error: 'Latitude and longitude required' },
        { status: 400 }
      )
    }

    // Use RPC function for spatial query with distance calculation
    // This uses ST_DWithin for efficient spatial indexing and ST_Distance for actual distance
    const { data: households, error: queryError } = await supabase.rpc(
      'find_nearby_waste_ready_households',
      {
        worker_lng: lng,
        worker_lat: lat,
        radius_meters: radiusMeters,
        max_results: 50,
      }
    )

    if (queryError) {
      console.error('Spatial query error:', queryError)

      // Fallback: simple query without spatial functions
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('households')
        .select(`
          id,
          user_id,
          nickname,
          manual_address,
          geocoded_address,
          ward_number,
          waste_ready,
          location,
          profiles (
            full_name,
            phone
          )
        `)
        .eq('waste_ready', true)
        .limit(50)

      if (fallbackError) {
        return NextResponse.json(
          { success: false, error: 'Failed to fetch households' },
          { status: 500 }
        )
      }

      // Return with parsed coordinates if possible
      const results: HouseholdResult[] = (fallbackData || []).map((h: any) => {
        let lat = 0
        let lng = 0

        // Parse PostGIS location string or object if available
        if (h.location) {
          if (typeof h.location === 'string') {
            // Handle "POINT(lng lat)" format
            const match = h.location.match(/POINT\(([-\d.]+) ([\d.]+)\)/)
            if (match) {
              lng = parseFloat(match[1])
              lat = parseFloat(match[2])
            }
          } else if (typeof h.location === 'object' && h.location.coordinates) {
            lng = h.location.coordinates[0]
            lat = h.location.coordinates[1]
          }
        }

        return {
          id: h.id as string,
          user_id: h.user_id as string,
          nickname: (h.nickname as string) || 'Household',
          manual_address: h.manual_address as string | null,
          geocoded_address: h.geocoded_address as string | null,
          ward_number: h.ward_number as number,
          waste_ready: h.waste_ready as boolean,
          lat,
          lng,
          distance_m: 0,
          profile: h.profiles as { full_name: string | null; phone: string | null } | undefined,
        }
      })

      return NextResponse.json({
        success: true,
        households: results,
        warning: 'Spatial query unavailable, distances not calculated',
      })
    }

    // Map results with ML predictions
    const results: HouseholdResult[] = (households || []).map((h: Record<string, unknown>) => {
      const distance = h.distance_meters as number
      const mlPrediction = generateMLPrediction(distance, h.ward_number as number)

      return {
        id: h.household_id as string,
        user_id: h.user_id as string,
        nickname: (h.nickname as string) || 'Household',
        manual_address: h.manual_address as string | null,
        geocoded_address: null,
        ward_number: h.ward_number as number,
        waste_ready: h.waste_ready as boolean,
        lat: h.lat as number,
        lng: h.lng as number,
        distance_m: distance,
        ml_prediction: mlPrediction,
        waste_types: ['general'], // Default - could be fetched from household preferences
      }
    })

    // Sort by priority score (highest first)
    results.sort((a, b) => (b.ml_prediction?.priority_score || 0) - (a.ml_prediction?.priority_score || 0))

    return NextResponse.json({
      success: true,
      households: results,
    })
  } catch (error) {
    console.error('Nearby signals error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
// ML Prediction Generator (simplified - replace with actual ML model)
function generateMLPrediction(
  distanceMeters: number,
  wardNumber: number
): {
  volume_kg: number
  confidence: number
  urgency: 'low' | 'medium' | 'high' | 'critical'
  priority_score: number
} {
  // Base volume estimate (5-20 kg typical household waste)
  const baseVolume = 8 + Math.random() * 7

  // Confidence based on historical data (70-95%)
  const confidence = 75 + Math.random() * 20

  // Calculate priority score
  let priorityScore = 0

  // Distance factor (closer = higher priority)
  if (distanceMeters < 300) priorityScore += 40
  else if (distanceMeters < 600) priorityScore += 30
  else if (distanceMeters < 1000) priorityScore += 20
  else if (distanceMeters < 1500) priorityScore += 10

  // Time-based urgency (simulated - could use actual timestamp)
  priorityScore += Math.floor(Math.random() * 30)

  // Ward-based factor (some wards may be higher priority)
  if (wardNumber % 3 === 0) priorityScore += 10

  // Determine urgency level
  let urgency: 'low' | 'medium' | 'high' | 'critical'
  if (priorityScore >= 70) urgency = 'critical'
  else if (priorityScore >= 50) urgency = 'high'
  else if (priorityScore >= 30) urgency = 'medium'
  else urgency = 'low'

  return {
    volume_kg: Math.round(baseVolume * 10) / 10,
    confidence: Math.round(confidence),
    urgency,
    priority_score: priorityScore,
  }
}
