/**
 * GET /api/worker/predictions
 * Worker-facing predictions: Returns hotspot predictions for the worker's assigned ward
 * Shows predicted high-volume areas so workers can plan their routes
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Authenticate
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get worker profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, assignments:worker_assignments(ward_number)')
      .eq('id', user.id)
      .single()

    const assignments = profile?.assignments as any
    const ward_number = Array.isArray(assignments) ? assignments[0]?.ward_number : (assignments?.ward_number || null)

    if (!profile || (profile.role !== 'worker' && profile.role !== 'hks_worker' && profile.role !== 'admin')) {
      return NextResponse.json({ success: false, error: 'Worker access required' }, { status: 403 })
    }

    const today = new Date().toISOString().split('T')[0]

    // Fetch predictions - for the worker's ward if assigned, otherwise all wards
    let query = supabase
      .from('hotspot_predictions')
      .select('*')
      .gte('prediction_date', today)
      .order('priority_level', { ascending: true })
      .order('predicted_volume_kg', { ascending: false })

    if (ward_number && profile.role !== 'admin') {
      query = query.eq('ward_number', ward_number)
    }

    const { data: predictions, error: predError } = await query.limit(20)

    // Also fetch recent signals count for context
    const yesterdayDate = new Date()
    yesterdayDate.setDate(yesterdayDate.getDate() - 1)

    let signalsQuery = supabase
      .from('signals')
      .select('ward_number', { count: 'exact' })
      .gte('created_at', yesterdayDate.toISOString())

    if (ward_number && profile.role !== 'admin') {
      signalsQuery = signalsQuery.eq('ward_number', ward_number)
    }

    const { count: recentSignals } = await signalsQuery

    // Fetch waste hotspots (illegal dumping spots) near worker's ward
    let hotspotsQuery = supabase
      .from('waste_hotspots')
      .select('id, hotspot_name, hotspot_type, severity, address, estimated_volume_cubic_m, status, priority')
      .eq('status', 'active')
      .order('severity', { ascending: false })
      .limit(5)

    if (ward_number && profile.role !== 'admin') {
      hotspotsQuery = hotspotsQuery.eq('ward_number', ward_number)
    }

    const { data: hotspots } = await hotspotsQuery

    // Map predictions to worker-friendly format
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    const formattedPredictions = (predictions || [])
      .sort((a, b) => {
        const aP = priorityOrder[a.priority_level as keyof typeof priorityOrder] ?? 3
        const bP = priorityOrder[b.priority_level as keyof typeof priorityOrder] ?? 3
        return aP - bP
      })
      .map(p => ({
        wardNumber: p.ward_number,
        district: p.district,
        predictedVolumeKg: p.predicted_volume_kg,
        confidence: p.confidence_score,
        peakHourStart: p.peak_hour_start,
        peakHourEnd: p.peak_hour_end,
        extraPickupsNeeded: p.extra_pickups_needed,
        priority: p.priority_level,
        historicalAvgKg: p.historical_avg_kg,
        isWeekend: p.is_weekend,
        lat: p.centroid_lat,
        lng: p.centroid_lng,
      }))

    // Summary stats
    const criticalCount = formattedPredictions.filter(p => p.priority === 'critical').length
    const highCount = formattedPredictions.filter(p => p.priority === 'high').length
    const totalExtraPickups = formattedPredictions.reduce((sum, p) => sum + (p.extraPickupsNeeded || 0), 0)
    const totalPredictedVolume = formattedPredictions.reduce((sum, p) => sum + (p.predictedVolumeKg || 0), 0)

    return NextResponse.json({
      success: true,
      workerWard: ward_number,
      predictions: formattedPredictions,
      hotspots: hotspots || [],
      summary: {
        totalPredictions: formattedPredictions.length,
        criticalWards: criticalCount,
        highPriorityWards: highCount,
        totalExtraPickups,
        totalPredictedVolumeKg: Math.round(totalPredictedVolume),
        recentSignals24h: recentSignals || 0,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
