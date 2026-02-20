/**
 * GET /api/admin/performance
 * Performance Dashboards: KPIs for route efficiency, crew performance, environmental impact
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  return profile?.role === 'admin' ? user : null
}

interface WorkerPerformance {
  workerId: string
  workerName: string
  wardNumber: number | null
  
  // Collection metrics
  totalCollections: number
  totalMissedStops: number
  collectionRate: number
  
  // Efficiency
  avgPickupTimeMins: number
  totalDistanceKm: number
  routeEfficiency: number
  
  // Financial
  totalFeesCollected: number
  
  // Quality
  avgCitizenRating: number
  wellSegregatedRate: number
  
  // Time
  avgStartTime: string
  avgEndTime: string
  hoursWorked: number
}

interface EnvironmentalImpact {
  totalWasteKg: number
  wetWasteKg: number
  dryWasteKg: number
  recyclableKg: number
  hazardousKg: number
  
  recyclingRate: number
  compostRate: number
  landfillDiversionRate: number
  
  co2AvoidedKg: number
  treesEquivalent: number
  plasticBottlesRecycled: number
}

interface OverallKPIs {
  // Coverage
  totalHouseholds: number
  householdsServiced: number
  coverageRate: number
  
  // Efficiency
  avgResponseTimeMins: number
  onTimeRate: number
  missedStopRate: number
  
  // Financial
  totalRevenue: number
  avgRevenuePerHousehold: number
  collectionRate: number
  
  // Satisfaction
  avgCitizenRating: number
  complaintsCount: number
  complaintResolutionRate: number
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const admin = await requireAdmin(supabase)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'week' // day, week, month
    const district = searchParams.get('district') || 'Ernakulam'
    const workerId = searchParams.get('workerId')

    // Calculate date range
    const now = new Date()
    const startDate = new Date()
    if (period === 'day') {
      startDate.setDate(now.getDate() - 1)
    } else if (period === 'week') {
      startDate.setDate(now.getDate() - 7)
    } else {
      startDate.setDate(now.getDate() - 30)
    }

    // Fetch all required data in parallel
    const [
      collectionLogsRes,
      missedStopsRes,
      workerShiftsRes,
      signalsRes,
      householdsRes,
      workersRes,
    ] = await Promise.all([
      // Collection logs
      supabase
        .from('collection_logs')
        .select('*')
        .gte('pickup_time', startDate.toISOString())
        .order('pickup_time', { ascending: false }),
      
      // Missed stops
      supabase
        .from('missed_stops')
        .select('*')
        .gte('missed_at', startDate.toISOString()),
      
      // Worker shifts
      supabase
        .from('worker_shifts')
        .select('*')
        .gte('shift_date', startDate.toISOString().split('T')[0]),
      
      // Signals for response time
      supabase
        .from('signals')
        .select('id, created_at, collected_at, status')
        .gte('created_at', startDate.toISOString()),
      
      // Total households
      supabase
        .from('households')
        .select('id', { count: 'exact' }),
      
      // Workers with assignments
      supabase
        .from('profiles')
        .select(`
          id, full_name,
          worker_assignments!left(ward_number, district, is_active)
        `)
        .eq('role', 'worker'),
    ])

    const collectionLogs = collectionLogsRes.data || []
    const missedStops = missedStopsRes.data || []
    const workerShifts = workerShiftsRes.data || []
    const signals = signalsRes.data || []
    const totalHouseholds = householdsRes.count || 0
    const workers = workersRes.data || []

    // === Calculate Worker Performance ===
    const workerPerformanceMap: Record<string, WorkerPerformance> = {}

    // Initialize workers
    workers.forEach((w) => {
      const assignment = Array.isArray(w.worker_assignments) 
        ? w.worker_assignments.find(a => a.is_active)
        : w.worker_assignments
      
      workerPerformanceMap[w.id] = {
        workerId: w.id,
        workerName: w.full_name || 'Unknown Worker',
        wardNumber: assignment?.ward_number || null,
        totalCollections: 0,
        totalMissedStops: 0,
        collectionRate: 0,
        avgPickupTimeMins: 0,
        totalDistanceKm: 0,
        routeEfficiency: 0,
        totalFeesCollected: 0,
        avgCitizenRating: 0,
        wellSegregatedRate: 0,
        avgStartTime: '',
        avgEndTime: '',
        hoursWorked: 0,
      }
    })

    // Process collection logs
    const ratingsByWorker: Record<string, number[]> = {}
    const segregationByWorker: Record<string, { well: number; total: number }> = {}
    const pickupTimes: Record<string, number[]> = {}

    collectionLogs.forEach((log) => {
      const wid = log.worker_id
      if (!workerPerformanceMap[wid]) return

      workerPerformanceMap[wid].totalCollections++
      workerPerformanceMap[wid].totalFeesCollected += log.fee_collected || 0

      if (log.citizen_rating) {
        if (!ratingsByWorker[wid]) ratingsByWorker[wid] = []
        ratingsByWorker[wid].push(log.citizen_rating)
      }

      if (log.waste_quality) {
        if (!segregationByWorker[wid]) segregationByWorker[wid] = { well: 0, total: 0 }
        segregationByWorker[wid].total++
        if (log.waste_quality === 'well_segregated') segregationByWorker[wid].well++
      }

      // Calculate pickup time if arrival and departure available
      if (log.arrival_time && log.departure_time) {
        const mins = (new Date(log.departure_time).getTime() - new Date(log.arrival_time).getTime()) / 60000
        if (mins > 0 && mins < 60) {
          if (!pickupTimes[wid]) pickupTimes[wid] = []
          pickupTimes[wid].push(mins)
        }
      }
    })

    // Process missed stops
    missedStops.forEach((miss) => {
      const wid = miss.worker_id
      if (workerPerformanceMap[wid]) {
        workerPerformanceMap[wid].totalMissedStops++
      }
    })

    // Process worker shifts for hours and distance
    const shiftTimesByWorker: Record<string, { starts: Date[]; ends: Date[] }> = {}
    workerShifts.forEach((shift) => {
      const wid = shift.worker_id
      if (!workerPerformanceMap[wid]) return

      workerPerformanceMap[wid].totalDistanceKm += shift.total_distance_km || 0

      if (shift.start_time) {
        if (!shiftTimesByWorker[wid]) shiftTimesByWorker[wid] = { starts: [], ends: [] }
        shiftTimesByWorker[wid].starts.push(new Date(shift.start_time))
      }
      if (shift.end_time) {
        if (!shiftTimesByWorker[wid]) shiftTimesByWorker[wid] = { starts: [], ends: [] }
        shiftTimesByWorker[wid].ends.push(new Date(shift.end_time))
        
        // Calculate hours worked
        if (shift.start_time) {
          const hours = (new Date(shift.end_time).getTime() - new Date(shift.start_time).getTime()) / 3600000
          workerPerformanceMap[wid].hoursWorked += hours
        }
      }
    })

    // Calculate derived metrics
    Object.keys(workerPerformanceMap).forEach((wid) => {
      const wp = workerPerformanceMap[wid]
      const total = wp.totalCollections + wp.totalMissedStops
      
      wp.collectionRate = total > 0 ? Math.round((wp.totalCollections / total) * 100) : 0
      
      if (ratingsByWorker[wid]?.length) {
        wp.avgCitizenRating = Math.round(
          (ratingsByWorker[wid].reduce((a, b) => a + b, 0) / ratingsByWorker[wid].length) * 10
        ) / 10
      }
      
      if (segregationByWorker[wid]?.total) {
        wp.wellSegregatedRate = Math.round(
          (segregationByWorker[wid].well / segregationByWorker[wid].total) * 100
        )
      }
      
      if (pickupTimes[wid]?.length) {
        wp.avgPickupTimeMins = Math.round(
          (pickupTimes[wid].reduce((a, b) => a + b, 0) / pickupTimes[wid].length) * 10
        ) / 10
      }

      // Route efficiency (simplified: collections per km)
      if (wp.totalDistanceKm > 0) {
        wp.routeEfficiency = Math.round((wp.totalCollections / wp.totalDistanceKm) * 10) / 10
      }

      // Average shift times
      if (shiftTimesByWorker[wid]?.starts.length) {
        const avgStart = new Date(
          shiftTimesByWorker[wid].starts.reduce((sum, d) => sum + d.getTime(), 0) / 
          shiftTimesByWorker[wid].starts.length
        )
        wp.avgStartTime = avgStart.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      }
      if (shiftTimesByWorker[wid]?.ends.length) {
        const avgEnd = new Date(
          shiftTimesByWorker[wid].ends.reduce((sum, d) => sum + d.getTime(), 0) / 
          shiftTimesByWorker[wid].ends.length
        )
        wp.avgEndTime = avgEnd.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      }

      wp.hoursWorked = Math.round(wp.hoursWorked * 10) / 10
    })

    // Filter to specific worker if requested
    let workerPerformance = Object.values(workerPerformanceMap)
      .filter(w => w.totalCollections > 0 || w.totalMissedStops > 0)
      .sort((a, b) => b.totalCollections - a.totalCollections)

    if (workerId) {
      workerPerformance = workerPerformance.filter(w => w.workerId === workerId)
    }

    // === Calculate Environmental Impact ===
    let wetWasteKg = 0
    let dryWasteKg = 0
    let recyclableKg = 0
    let hazardousKg = 0

    collectionLogs.forEach((log) => {
      const weight = log.actual_weight_kg || log.estimated_weight_kg || 2
      const types = log.waste_types || []
      
      if (types.includes('wet')) wetWasteKg += weight * 0.5
      if (types.includes('dry')) dryWasteKg += weight * 0.3
      if (types.includes('recyclable')) recyclableKg += weight * 0.15
      if (types.includes('hazardous') || types.includes('e-waste')) hazardousKg += weight * 0.05
      
      // If no types, estimate based on averages
      if (types.length === 0) {
        wetWasteKg += weight * 0.5
        dryWasteKg += weight * 0.35
        recyclableKg += weight * 0.15
      }
    })

    const totalWasteKg = wetWasteKg + dryWasteKg + recyclableKg + hazardousKg
    const recyclingRate = totalWasteKg > 0 ? Math.round((recyclableKg / totalWasteKg) * 100) : 0
    const compostRate = totalWasteKg > 0 ? Math.round((wetWasteKg * 0.8 / totalWasteKg) * 100) : 0 // 80% of wet is compostable
    const landfillDiversionRate = recyclingRate + compostRate

    // Environmental calculations
    const co2AvoidedKg = Math.round(recyclableKg * 2.5 + wetWasteKg * 0.5) // Simplified CO2 factors
    const treesEquivalent = Math.round(co2AvoidedKg / 21) // ~21kg CO2 per tree per year
    const plasticBottlesRecycled = Math.round(recyclableKg * 0.3 / 0.025) // ~25g per plastic bottle

    const environmentalImpact: EnvironmentalImpact = {
      totalWasteKg: Math.round(totalWasteKg),
      wetWasteKg: Math.round(wetWasteKg),
      dryWasteKg: Math.round(dryWasteKg),
      recyclableKg: Math.round(recyclableKg),
      hazardousKg: Math.round(hazardousKg),
      recyclingRate,
      compostRate,
      landfillDiversionRate: Math.min(100, landfillDiversionRate),
      co2AvoidedKg,
      treesEquivalent,
      plasticBottlesRecycled,
    }

    // === Calculate Overall KPIs ===
    const householdsServiced = new Set(collectionLogs.map(l => l.household_id)).size
    const totalCollections = collectionLogs.length
    const totalMissed = missedStops.length
    const totalRevenue = collectionLogs.reduce((sum, l) => sum + (l.fee_collected || 0), 0)

    // Response time calculation
    const completedSignals = signals.filter(s => s.status === 'collected' && s.collected_at)
    let avgResponseTimeMins = 0
    if (completedSignals.length > 0) {
      const responseTimes = completedSignals.map(s => {
        const mins = (new Date(s.collected_at!).getTime() - new Date(s.created_at).getTime()) / 60000
        return mins < 1440 ? mins : 1440 // Cap at 24 hours
      })
      avgResponseTimeMins = Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    }

    // Citizen ratings
    const allRatings = collectionLogs.filter(l => l.citizen_rating).map(l => l.citizen_rating)
    const avgCitizenRating = allRatings.length > 0
      ? Math.round((allRatings.reduce((a, b) => a + b, 0) / allRatings.length) * 10) / 10
      : 0

    const overallKPIs: OverallKPIs = {
      totalHouseholds,
      householdsServiced,
      coverageRate: totalHouseholds > 0 ? Math.round((householdsServiced / totalHouseholds) * 100) : 0,
      avgResponseTimeMins,
      onTimeRate: 85, // Placeholder - would need SLA definitions
      missedStopRate: totalCollections + totalMissed > 0 
        ? Math.round((totalMissed / (totalCollections + totalMissed)) * 100) 
        : 0,
      totalRevenue: Math.round(totalRevenue),
      avgRevenuePerHousehold: householdsServiced > 0 ? Math.round(totalRevenue / householdsServiced) : 0,
      collectionRate: signals.length > 0 
        ? Math.round((completedSignals.length / signals.length) * 100) 
        : 0,
      avgCitizenRating,
      complaintsCount: missedStops.filter(m => m.reason === 'other').length,
      complaintResolutionRate: 90, // Placeholder
    }

    return NextResponse.json({
      success: true,
      period,
      dateRange: {
        start: startDate.toISOString().split('T')[0],
        end: now.toISOString().split('T')[0],
      },
      overallKPIs,
      workerPerformance,
      environmentalImpact,
    })
  } catch (error) {
    console.error('Performance API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
