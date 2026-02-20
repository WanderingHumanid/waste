/**
 * POST /api/worker/log-collection
 * Field Data Capture: Log detailed pickup with timestamps, weight, photo proof
 * Creates collection_log entry and updates signal status
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface CollectionLogRequest {
  signalId?: string
  householdId: string
  
  // Timing
  arrivalTime?: string
  departureTime?: string
  
  // Waste details
  wasteTypes: string[]
  estimatedWeightKg?: number
  actualWeightKg?: number
  wasteQuality?: 'well_segregated' | 'partially_segregated' | 'not_segregated'
  
  // Verification
  photoUrl?: string
  gpsLat: number
  gpsLng: number
  gpsAccuracy?: number
  
  // Payment
  feeCollected?: number
  paymentMethod?: 'cash' | 'upi' | 'wallet' | 'exempt'
  paymentStatus?: 'paid' | 'pending' | 'waived'
  
  // Notes
  notes?: string
  workerNotes?: string
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
      .select('role, ward_number')
      .eq('id', user.id)
      .single()

    if (!profile || !['worker', 'hks_worker', 'admin'].includes(profile.role)) {
      return NextResponse.json({ success: false, error: 'Worker access required' }, { status: 403 })
    }

    const body: CollectionLogRequest = await request.json()
    const {
      signalId, householdId, arrivalTime, departureTime,
      wasteTypes, estimatedWeightKg, actualWeightKg, wasteQuality,
      photoUrl, gpsLat, gpsLng, gpsAccuracy,
      feeCollected, paymentMethod, paymentStatus,
      notes, workerNotes
    } = body

    if (!householdId || gpsLat === undefined || gpsLng === undefined) {
      return NextResponse.json(
        { success: false, error: 'householdId, gpsLat, gpsLng are required' },
        { status: 400 }
      )
    }

    // Get household info
    const { data: household, error: hhError } = await supabase
      .from('households')
      .select('id, ward_number, district, user_id')
      .eq('id', householdId)
      .single()

    if (hhError || !household) {
      return NextResponse.json({ success: false, error: 'Household not found' }, { status: 404 })
    }

    // Verify GPS proximity (50m radius)
    const { data: proximityCheck } = await supabase.rpc('verify_worker_proximity', {
      p_household_id: householdId,
      p_worker_lng: gpsLng,
      p_worker_lat: gpsLat,
      p_max_distance_meters: 100, // 100m for logging (more lenient)
    })
    const proximityVerified = proximityCheck?.is_within_range ?? false

    // Create collection log
    const { data: log, error: logError } = await supabase
      .from('collection_logs')
      .insert({
        signal_id: signalId || null,
        household_id: householdId,
        worker_id: user.id,
        ward_number: household.ward_number,
        district: household.district || 'Ernakulam',
        
        pickup_time: new Date().toISOString(),
        arrival_time: arrivalTime || null,
        departure_time: departureTime || null,
        
        waste_types: wasteTypes || [],
        estimated_weight_kg: estimatedWeightKg || null,
        actual_weight_kg: actualWeightKg || null,
        waste_quality: wasteQuality || null,
        
        photo_url: photoUrl || null,
        photo_verified: !!photoUrl,
        gps_lat: gpsLat,
        gps_lng: gpsLng,
        gps_accuracy_m: gpsAccuracy || null,
        proximity_verified: proximityVerified,
        
        fee_collected: feeCollected ?? 50,
        payment_method: paymentMethod || 'cash',
        payment_status: paymentStatus || 'paid',
        
        notes: notes || null,
        worker_notes: workerNotes || null,
      })
      .select('id')
      .single()

    if (logError) {
      console.error('Collection log error:', logError)
      return NextResponse.json({ success: false, error: 'Failed to log collection' }, { status: 500 })
    }

    // Update signal status if provided
    if (signalId) {
      await supabase
        .from('signals')
        .update({
          status: 'collected',
          collected_at: new Date().toISOString(),
          assigned_to: user.id,
          verification_photo_url: photoUrl || null,
          proximity_verified: proximityVerified,
        })
        .eq('id', signalId)
    }

    // Update household waste_ready
    await supabase
      .from('households')
      .update({ waste_ready: false, updated_at: new Date().toISOString() })
      .eq('id', householdId)

    // Update or create today's worker shift
    const today = new Date().toISOString().split('T')[0]
    const { data: existingShift } = await supabase
      .from('worker_shifts')
      .select('id, households_collected, total_waste_kg, total_fees_collected')
      .eq('worker_id', user.id)
      .eq('shift_date', today)
      .single()

    if (existingShift) {
      await supabase
        .from('worker_shifts')
        .update({
          households_collected: (existingShift.households_collected || 0) + 1,
          total_waste_kg: (existingShift.total_waste_kg || 0) + (actualWeightKg || estimatedWeightKg || 0),
          total_fees_collected: (existingShift.total_fees_collected || 0) + (feeCollected ?? 50),
          status: 'in_progress',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingShift.id)
    } else {
      await supabase
        .from('worker_shifts')
        .insert({
          worker_id: user.id,
          ward_number: household.ward_number,
          district: household.district || 'Ernakulam',
          shift_date: today,
          start_time: new Date().toISOString(),
          households_collected: 1,
          total_waste_kg: actualWeightKg || estimatedWeightKg || 0,
          total_fees_collected: feeCollected ?? 50,
          status: 'in_progress',
        })
    }

    // Award green credits to citizen
    try {
      await supabase.rpc('award_green_credits', {
        p_user_id: household.user_id,
        p_credits: wasteQuality === 'well_segregated' ? 10 : wasteQuality === 'partially_segregated' ? 5 : 2,
        p_reason: 'waste_collection',
      })
    } catch (e) {
      console.error('Green credits error:', e)
    }

    return NextResponse.json({
      success: true,
      logId: log.id,
      proximityVerified,
      message: 'Collection logged successfully',
    })
  } catch (error) {
    console.error('Log collection error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// GET: Retrieve collection logs for a worker
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
    const limit = parseInt(searchParams.get('limit') || '50')

    const { data: logs, error } = await supabase
      .from('collection_logs')
      .select(`
        id, pickup_time, waste_types, actual_weight_kg, waste_quality,
        photo_url, fee_collected, payment_status, proximity_verified,
        households(nickname, ward_number)
      `)
      .eq('worker_id', user.id)
      .gte('pickup_time', `${date}T00:00:00`)
      .lt('pickup_time', `${date}T23:59:59`)
      .order('pickup_time', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Fetch logs error:', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch logs' }, { status: 500 })
    }

    return NextResponse.json({ success: true, logs })
  } catch (error) {
    console.error('Get logs error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
