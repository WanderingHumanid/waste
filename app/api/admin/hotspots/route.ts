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

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const admin = await requireAdmin(supabase)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const district = searchParams.get('district') || 'Ernakulam'
    const layer = searchParams.get('layer') || 'signals' // 'signals' | 'households' | 'predictions'

    // --- Real-time waste signal points ---
    const { data: signalPoints, error: sigErr } = await supabase
      .from('signals')
      .select(`
        id,
        status,
        waste_types,
        created_at,
        households!inner(
          id,
          ward_number,
          district,
          waste_ready,
          location
        )
      `)
      .in('status', ['pending', 'acknowledged'])
      .order('created_at', { ascending: false })
      .limit(500)

    if (sigErr) console.error('[hotspots signal err]', sigErr)

    // --- Household density (all households) ---
    const { data: householdsRaw, error: hhErr } = await supabase
      .from('households')
      .select('id, ward_number, district, waste_ready, location')
      .limit(1000)

    if (hhErr) console.error('[hotspots households err]', hhErr)

    // --- Worker locations (from active shift data) ---
    const { data: workers, error: wErr } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'worker')

    if (wErr) console.error('[hotspots workers err]', wErr)

    // Worker assignments for ward info
    const { data: assignments } = await supabase
      .from('worker_assignments')
      .select('worker_id, ward_number, district')
      .eq('is_active', true)

    const assignmentMap: Record<string, { worker_id: string; ward_number: number | null; district: string | null }> = {}
    ;(assignments || []).forEach((a) => { assignmentMap[a.worker_id] = a })

    // Parse PostGIS location string/object → {lat, lng}
    const parseLocation = (loc: unknown): { lat: number; lng: number } | null => {
      if (!loc) return null
      if (typeof loc === 'string') {
        // POINT(lng lat) format
        const m = loc.match(/POINT\(([^\s]+)\s+([^\s)]+)\)/)
        if (m) return { lat: parseFloat(m[2]), lng: parseFloat(m[1]) }
      }
      if (typeof loc === 'object' && loc !== null) {
        const obj = loc as Record<string, unknown>
        if ('coordinates' in obj && Array.isArray(obj.coordinates)) {
          return { lat: obj.coordinates[1] as number, lng: obj.coordinates[0] as number }
        }
      }
      return null
    }

    // Build heatmap data points from signals
    const signalHeatmap = (signalPoints || [])
      .map((s: Record<string, unknown>) => {
        const hh = Array.isArray(s.households) ? s.households[0] : s.households as Record<string, unknown> | null
        if (!hh) return null
        const coords = parseLocation(hh.location)
        if (!coords) return null
        return {
          id: s.id as string,
          lat: coords.lat,
          lng: coords.lng,
          intensity: s.status === 'pending' ? 1.0 : 0.6,
          status: s.status as string,
          ward: hh.ward_number as number | null,
          wasteTypes: s.waste_types as string[],
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)

    // Build household density grid
    const householdPoints = (householdsRaw || [])
      .map((h: Record<string, unknown>) => {
        const coords = parseLocation(h.location)
        if (!coords) return null
        return {
          id: h.id as string,
          lat: coords.lat,
          lng: coords.lng,
          wasteReady: h.waste_ready as boolean,
          ward: h.ward_number as number | null,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)

    // ML Prediction Layer — Generate simulated predictions based on historical density
    // In production: replace with actual ML model output (e.g., Prophet / ARIMA predictions)
    const piravomCenter = { lat: 9.9943, lng: 76.5373 }
    const mlPredictions = Array.from({ length: 12 }, (_, i) => {
      const angle = (i / 12) * Math.PI * 2
      const radius = 0.005 + Math.random() * 0.012
      const intensity = 0.4 + Math.random() * 0.6
      return {
        id: `pred_${i}`,
        lat: piravomCenter.lat + Math.sin(angle) * radius,
        lng: piravomCenter.lng + Math.cos(angle) * radius,
        intensity,
        predictedVolume: Math.round(intensity * 85),
        confidence: Math.round(70 + Math.random() * 25),
        peakHour: `${8 + Math.floor(Math.random() * 4)}:00 – ${10 + Math.floor(Math.random() * 4)}:00`,
        type: 'ml_prediction',
      }
    })

    // Worker markers
    const workerMarkers = (workers || []).map((w) => {
      const assignment = assignmentMap[w.id]
      return {
        id: w.id,
        name: w.full_name || 'Worker',
        ward: assignment?.ward_number || null,
        district: assignment?.district || null,
      }
    })

    // Ward-level summary
    const wardSummary: Record<number, { signalCount: number; householdCount: number }> = {}
    signalHeatmap.forEach((s) => {
      if (s?.ward) {
        if (!wardSummary[s.ward]) wardSummary[s.ward] = { signalCount: 0, householdCount: 0 }
        wardSummary[s.ward].signalCount++
      }
    })
    householdPoints.forEach((h) => {
      if (h?.ward) {
        if (!wardSummary[h.ward]) wardSummary[h.ward] = { signalCount: 0, householdCount: 0 }
        wardSummary[h.ward].householdCount++
      }
    })

    const topWards = Object.entries(wardSummary)
      .map(([ward, data]) => ({ ward: parseInt(ward), ...data }))
      .sort((a, b) => b.signalCount - a.signalCount)
      .slice(0, 5)

    return NextResponse.json({
      success: true,
      layers: {
        signals: signalHeatmap,
        households: householdPoints,
        mlPredictions,
        workers: workerMarkers,
      },
      topWards,
      center: piravomCenter,
    })
  } catch (err) {
    console.error('[admin/hotspots]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
