/**
 * GET /api/admin/predictions
 * Predictive Hotspot Detection: ML-based predictions for waste zones
 * Analyzes historical data to predict high-waste areas and recommend extra pickups
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

interface WardPrediction {
  wardNumber: number
  district: string
  predictedVolumeKg: number
  confidenceScore: number
  peakHourStart: number
  peakHourEnd: number
  historicalAvgKg: number
  trend: 'increasing' | 'stable' | 'decreasing'
  extraPickupsNeeded: number
  priorityLevel: 'low' | 'medium' | 'high' | 'critical'
  factors: {
    isWeekend: boolean
    dayOfWeek: string
    recentSignalCount: number
    avgResponseTime: number
    missedStopRate: number
  }
  centroid: { lat: number; lng: number }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const admin = await requireAdmin(supabase)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const district = searchParams.get('district') || 'Ernakulam'
    const daysAhead = parseInt(searchParams.get('daysAhead') || '1')

    // Calculate prediction date
    const predictionDate = new Date()
    predictionDate.setDate(predictionDate.getDate() + daysAhead)
    const dayOfWeek = predictionDate.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

    // Get historical data (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Fetch historical signals by ward
    const { data: historicalSignals } = await supabase
      .from('signals')
      .select(`
        id, created_at, waste_types, status,
        households!inner(ward_number, location)
      `)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .limit(2000)

    // Fetch collection logs for weight data
    const { data: collectionLogs } = await supabase
      .from('collection_logs')
      .select('ward_number, actual_weight_kg, pickup_time')
      .gte('pickup_time', thirtyDaysAgo.toISOString())
      .limit(2000)

    // Fetch missed stops
    const { data: missedStops } = await supabase
      .from('missed_stops')
      .select('ward_number, missed_at')
      .gte('missed_at', thirtyDaysAgo.toISOString())

    // Aggregate data by ward
    const wardStats: Record<number, {
      signalCount: number
      signalsByDay: Record<number, number>  // day of week -> count
      totalWeightKg: number
      weightEntries: number
      missedCount: number
      locations: { lat: number; lng: number }[]
      avgHour: number
      hourSum: number
    }> = {}

      // Process signals
      ; (historicalSignals || []).forEach((sig) => {
        const hh = Array.isArray(sig.households) ? sig.households[0] : sig.households
        if (!hh?.ward_number) return
        const ward = hh.ward_number as number

        if (!wardStats[ward]) {
          wardStats[ward] = {
            signalCount: 0, signalsByDay: {}, totalWeightKg: 0, weightEntries: 0,
            missedCount: 0, locations: [], avgHour: 0, hourSum: 0
          }
        }

        wardStats[ward].signalCount++
        const sigDate = new Date(sig.created_at)
        const sigDay = sigDate.getDay()
        wardStats[ward].signalsByDay[sigDay] = (wardStats[ward].signalsByDay[sigDay] || 0) + 1
        wardStats[ward].hourSum += sigDate.getHours()

        // Parse location
        if (hh.location) {
          try {
            const loc = hh.location as { coordinates?: number[] }
            if (loc.coordinates) {
              wardStats[ward].locations.push({ lat: loc.coordinates[1], lng: loc.coordinates[0] })
            }
          } catch { }
        }
      })

      // Process collection logs
      ; (collectionLogs || []).forEach((log) => {
        const ward = log.ward_number
        if (!ward || !wardStats[ward]) return
        if (log.actual_weight_kg) {
          wardStats[ward].totalWeightKg += log.actual_weight_kg
          wardStats[ward].weightEntries++
        }
      })

      // Process missed stops
      ; (missedStops || []).forEach((miss) => {
        const ward = miss.ward_number
        if (!ward || !wardStats[ward]) return
        wardStats[ward].missedCount++
      })

    // Generate predictions for each ward
    const predictions: WardPrediction[] = []
    const piravomCenter = { lat: 9.9943, lng: 76.5373 }

    for (const [wardStr, stats] of Object.entries(wardStats)) {
      const ward = parseInt(wardStr)
      if (stats.signalCount < 1) continue

      // Calculate historical average for this day of week
      const sameDaySignals = stats.signalsByDay[dayOfWeek] || 0
      const avgSignalsThisDay = sameDaySignals / 4 // ~4 weeks of data

      // Calculate weight average
      const avgWeightKg = stats.weightEntries > 0
        ? stats.totalWeightKg / stats.weightEntries
        : 2.5 // Default 2.5kg per household

      // Weekend adjustment (typically 20-40% more waste)
      const weekendMultiplier = isWeekend ? 1.3 : 1.0

      // Calculate predicted volume
      const baseVolume = avgSignalsThisDay * avgWeightKg
      const predictedVolumeKg = Math.round(baseVolume * weekendMultiplier * 10) / 10

      // Calculate confidence based on data availability
      const dataPoints = stats.signalCount
      const confidence = Math.min(95, 40 + dataPoints * 2)

      // Calculate trend (compare first half vs second half of period)
      let trend: 'increasing' | 'stable' | 'decreasing' = 'stable'
      // Simplified: if weekend has more than weekday average, it's increasing pattern
      const weekdayAvg = ([1, 2, 3, 4, 5].reduce((sum, d) => sum + (stats.signalsByDay[d] || 0), 0)) / 5
      const weekendAvg = ([0, 6].reduce((sum, d) => sum + (stats.signalsByDay[d] || 0), 0)) / 2
      if (weekendAvg > weekdayAvg * 1.2) trend = 'increasing'
      if (weekendAvg < weekdayAvg * 0.8) trend = 'decreasing'

      // Calculate avg hour
      const avgHour = stats.signalCount > 0
        ? Math.round(stats.hourSum / stats.signalCount)
        : 9

      // Calculate centroid
      let centroidLat = piravomCenter.lat + (ward - 10) * 0.002
      let centroidLng = piravomCenter.lng + (ward % 5 - 2) * 0.003
      if (stats.locations.length > 0) {
        centroidLat = stats.locations.reduce((sum, l) => sum + l.lat, 0) / stats.locations.length
        centroidLng = stats.locations.reduce((sum, l) => sum + l.lng, 0) / stats.locations.length
      }

      // Calculate missed stop rate
      const missedStopRate = stats.signalCount > 0
        ? (stats.missedCount / stats.signalCount) * 100
        : 0

      // Determine priority and extra pickups
      let priorityLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'
      let extraPickupsNeeded = 0

      if (predictedVolumeKg > 100 || missedStopRate > 15) {
        priorityLevel = 'critical'
        extraPickupsNeeded = 2
      } else if (predictedVolumeKg > 50 || missedStopRate > 10) {
        priorityLevel = 'high'
        extraPickupsNeeded = 1
      } else if (predictedVolumeKg > 25 || isWeekend) {
        priorityLevel = 'medium'
        extraPickupsNeeded = isWeekend ? 1 : 0
      }

      predictions.push({
        wardNumber: ward,
        district,
        predictedVolumeKg: Math.max(5, predictedVolumeKg),
        confidenceScore: confidence,
        peakHourStart: avgHour,
        peakHourEnd: Math.min(23, avgHour + 2),
        historicalAvgKg: Math.round(avgWeightKg * 10) / 10,
        trend,
        extraPickupsNeeded,
        priorityLevel,
        factors: {
          isWeekend,
          dayOfWeek: dayNames[dayOfWeek],
          recentSignalCount: stats.signalCount,
          avgResponseTime: 45, // Placeholder - would calculate from actual data
          missedStopRate: Math.round(missedStopRate * 10) / 10,
        },
        centroid: { lat: centroidLat, lng: centroidLng },
      })
    }

    // Sort by priority
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
    predictions.sort((a, b) => priorityOrder[b.priorityLevel] - priorityOrder[a.priorityLevel])

    // Cache predictions
    for (const pred of predictions) {
      const { error: upsertError } = await supabase
        .from('hotspot_predictions')
        .upsert({
          ward_number: pred.wardNumber,
          district: pred.district,
          prediction_date: predictionDate.toISOString().split('T')[0],
          predicted_volume_kg: pred.predictedVolumeKg,
          confidence_score: pred.confidenceScore,
          peak_hour_start: pred.peakHourStart,
          peak_hour_end: pred.peakHourEnd,
          is_weekend: pred.factors.isWeekend,
          historical_avg_kg: pred.historicalAvgKg,
          extra_pickups_needed: pred.extraPickupsNeeded,
          priority_level: pred.priorityLevel,
          centroid_lat: pred.centroid.lat,
          centroid_lng: pred.centroid.lng,
        }, { onConflict: 'ward_number,district,prediction_date' })
      if (upsertError) console.error(upsertError)
    }

    // Summary stats
    const summary = {
      predictionDate: predictionDate.toISOString().split('T')[0],
      dayOfWeek: dayNames[dayOfWeek],
      isWeekend,
      totalWardsAnalyzed: predictions.length,
      criticalZones: predictions.filter(p => p.priorityLevel === 'critical').length,
      highPriorityZones: predictions.filter(p => p.priorityLevel === 'high').length,
      totalPredictedVolume: Math.round(predictions.reduce((sum, p) => sum + p.predictedVolumeKg, 0)),
      extraPickupsRecommended: predictions.reduce((sum, p) => sum + p.extraPickupsNeeded, 0),
    }

    return NextResponse.json({
      success: true,
      summary,
      predictions,
    })
  } catch (error) {
    console.error('Predictions error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
