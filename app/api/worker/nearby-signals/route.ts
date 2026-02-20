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
      .select('role, ward_number')
      .eq('id', user.id)
      .single()

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
          profiles!households_user_id_fkey (
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

      // Return without distance calculation
      const results: HouseholdResult[] = (fallbackData || []).map((h: Record<string, unknown>) => ({
        id: h.id as string,
        user_id: h.user_id as string,
        nickname: (h.nickname as string) || 'Household',
        manual_address: h.manual_address as string | null,
        geocoded_address: h.geocoded_address as string | null,
        ward_number: h.ward_number as number,
        waste_ready: h.waste_ready as boolean,
        lat: 0, // Unknown without spatial query
        lng: 0,
        distance_m: 0,
        profile: h.profiles as { full_name: string | null; phone: string | null } | undefined,
      }))

      return NextResponse.json({
        success: true,
        households: results,
        warning: 'Spatial query unavailable, distances not calculated',
      })
    }

    // Map results
    const results: HouseholdResult[] = (households || []).map((h: Record<string, unknown>) => ({
      id: h.household_id as string,
      user_id: h.user_id as string,
      nickname: (h.nickname as string) || 'Household',
      manual_address: h.manual_address as string | null,
      geocoded_address: null,
      ward_number: h.ward_number as number,
      waste_ready: h.waste_ready as boolean,
      lat: h.lat as number,
      lng: h.lng as number,
      distance_m: h.distance_meters as number,
    }))

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
