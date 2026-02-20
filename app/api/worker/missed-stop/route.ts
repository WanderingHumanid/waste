/**
 * POST /api/worker/missed-stop
 * Field Data Capture: Log a missed collection with reason and photo proof
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const VALID_REASONS = [
  'no_access', 'gate_locked', 'resident_absent', 'waste_not_ready',
  'hazardous_waste', 'vehicle_full', 'time_constraint', 'wrong_location', 'other'
] as const

interface MissedStopRequest {
  householdId: string
  signalId?: string
  reason: typeof VALID_REASONS[number]
  reasonDetails?: string
  photoUrl?: string
  gpsLat: number
  gpsLng: number
  rescheduledFor?: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify worker
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['worker', 'hks_worker', 'admin'].includes(profile.role)) {
      return NextResponse.json({ success: false, error: 'Worker access required' }, { status: 403 })
    }

    const body: MissedStopRequest = await request.json()
    const { householdId, signalId, reason, reasonDetails, photoUrl, gpsLat, gpsLng, rescheduledFor } = body

    // Validate
    if (!householdId || !reason) {
      return NextResponse.json({ success: false, error: 'householdId and reason are required' }, { status: 400 })
    }

    if (!VALID_REASONS.includes(reason)) {
      return NextResponse.json({ success: false, error: 'Invalid reason' }, { status: 400 })
    }

    // Get household info
    const { data: household, error: hhError } = await supabase
      .from('households')
      .select('id, ward_number, district')
      .eq('id', householdId)
      .single()

    if (hhError || !household) {
      return NextResponse.json({ success: false, error: 'Household not found' }, { status: 404 })
    }

    // Create missed stop record
    const { data: missedStop, error: insertError } = await supabase
      .from('missed_stops')
      .insert({
        household_id: householdId,
        worker_id: user.id,
        signal_id: signalId || null,
        ward_number: household.ward_number,
        district: household.district || 'Ernakulam',
        reason,
        reason_details: reasonDetails || null,
        photo_url: photoUrl || null,
        gps_lat: gpsLat || null,
        gps_lng: gpsLng || null,
        rescheduled_for: rescheduledFor || null,
        missed_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Missed stop insert error:', insertError)
      return NextResponse.json({ success: false, error: 'Failed to log missed stop' }, { status: 500 })
    }

    // Update signal status if provided
    if (signalId) {
      await supabase
        .from('signals')
        .update({
          status: 'missed',
          notes: `Missed: ${reason}${reasonDetails ? ` - ${reasonDetails}` : ''}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', signalId)
    }

    // Update today's worker shift
    const today = new Date().toISOString().split('T')[0]
    const { data: existingShift } = await supabase
      .from('worker_shifts')
      .select('id, households_missed')
      .eq('worker_id', user.id)
      .eq('shift_date', today)
      .single()

    if (existingShift) {
      await supabase
        .from('worker_shifts')
        .update({
          households_missed: (existingShift.households_missed || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingShift.id)
    }

    // Notify admin about missed stop (for tracking)
    const { error: logError } = await supabase.from('admin_logs').insert({
      admin_id: null,
      action_type: 'missed_stop',
      target_user_id: user.id,
      target_entity: 'missed_stops',
      new_value: { household_id: householdId, reason, ward_number: household.ward_number },
      notes: `Worker missed collection: ${reason}`,
    })
    if (logError) console.error(logError)

    return NextResponse.json({
      success: true,
      missedStopId: missedStop.id,
      message: 'Missed stop logged. Consider rescheduling.',
    })
  } catch (error) {
    console.error('Missed stop error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// GET: Retrieve missed stops (for admin or worker review)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const { searchParams } = new URL(request.url)
    const resolved = searchParams.get('resolved')
    const date = searchParams.get('date')
    const workerId = searchParams.get('workerId')

    let query = supabase
      .from('missed_stops')
      .select(`
        id, reason, reason_details, photo_url, missed_at, resolved, rescheduled_for,
        households(nickname, ward_number, manual_address),
        profiles!worker_id(full_name)
      `)
      .order('missed_at', { ascending: false })
      .limit(100)

    // Workers see only their own, admins see all
    if (profile?.role !== 'admin') {
      query = query.eq('worker_id', user.id)
    } else if (workerId) {
      query = query.eq('worker_id', workerId)
    }

    if (resolved !== null) {
      query = query.eq('resolved', resolved === 'true')
    }

    if (date) {
      query = query.gte('missed_at', `${date}T00:00:00`).lt('missed_at', `${date}T23:59:59`)
    }

    const { data: missedStops, error } = await query

    if (error) {
      console.error('Fetch missed stops error:', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch missed stops' }, { status: 500 })
    }

    return NextResponse.json({ success: true, missedStops })
  } catch (error) {
    console.error('Get missed stops error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH: Resolve a missed stop
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['worker', 'hks_worker', 'admin'].includes(profile.role)) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    const body = await request.json()
    const { missedStopId, resolved, rescheduledFor } = body

    if (!missedStopId) {
      return NextResponse.json({ success: false, error: 'missedStopId required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('missed_stops')
      .update({
        resolved: resolved ?? true,
        resolved_at: resolved ? new Date().toISOString() : null,
        resolved_by: resolved ? user.id : null,
        rescheduled_for: rescheduledFor || null,
      })
      .eq('id', missedStopId)

    if (error) {
      console.error('Resolve missed stop error:', error)
      return NextResponse.json({ success: false, error: 'Failed to update' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Missed stop updated' })
  } catch (error) {
    console.error('Patch missed stop error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
