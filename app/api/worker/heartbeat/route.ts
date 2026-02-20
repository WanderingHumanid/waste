/**
 * POST /api/worker/heartbeat
 * Update worker's GPS position every 30 seconds
 * Stores in worker_locations table for tracking
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface HeartbeatRequest {
  lat: number
  lng: number
  accuracy?: number
  speed?: number
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

    const body: HeartbeatRequest = await request.json()
    const { lat, lng, accuracy, speed } = body

    // Validate coordinates
    if (lat === undefined || lng === undefined) {
      return NextResponse.json(
        { success: false, error: 'Latitude and longitude required' },
        { status: 400 }
      )
    }

    // Create location point in WKT format
    const locationWKT = `POINT(${lng} ${lat})`

    // Get active shift if any
    const { data: activeShift } = await supabase
      .from('shifts')
      .select('id')
      .eq('worker_id', user.id)
      .eq('status', 'active')
      .single()

    // Insert heartbeat into worker_locations
    const { error: insertError } = await supabase
      .from('worker_locations')
      .insert({
        worker_id: user.id,
        shift_id: activeShift?.id || null,
        location: locationWKT,
        accuracy_m: accuracy || null,
        speed_kmh: speed || null,
        recorded_at: new Date().toISOString(),
      })

    if (insertError) {
      console.error('Heartbeat insert error:', insertError)
      // Don't fail the request - heartbeat is best-effort
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Heartbeat error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
