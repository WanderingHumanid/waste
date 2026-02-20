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

// GET /api/admin/districts — list all Kerala districts with stats
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const admin = await requireAdmin(supabase)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const districtCode = searchParams.get('code')

    // If specific district requested, get full details
    if (districtCode) {
      // Get district info
      const { data: district, error: districtError } = await supabase
        .from('kerala_districts')
        .select('*')
        .eq('district_code', districtCode)
        .single()

      if (districtError || !district) {
        return NextResponse.json({ error: 'District not found' }, { status: 404 })
      }

      // Get active hotspots
      const { data: hotspots } = await supabase
        .from('waste_hotspots')
        .select('*')
        .eq('district_code', districtCode)
        .eq('status', 'active')
        .order('severity', { ascending: false })
        .limit(20)

      // Get recent stats (last 7 days)
      const { data: recentStats } = await supabase
        .from('district_waste_stats')
        .select('*')
        .eq('district_code', districtCode)
        .order('stat_date', { ascending: false })
        .limit(7)

      // Get wards if applicable (Piravom in Ernakulam)
      let wards = null
      if (districtCode === 'EKM') {
        const { data: wardData } = await supabase
          .from('wards')
          .select('ward_number, ward_name, population, area_sqkm, hks_workers_count')
          .eq('district', 'Ernakulam')
          .order('ward_number')
        wards = wardData
      }

      return NextResponse.json({
        success: true,
        district,
        hotspots: hotspots || [],
        recentStats: recentStats || [],
        wards,
      })
    }

    // List all districts with summary stats
    const { data: districts, error } = await supabase
      .from('kerala_districts')
      .select(`
        district_code,
        district_name,
        population_2024_est,
        daily_waste_tons,
        total_households,
        households_covered,
        coverage_pct,
        active_workers,
        annual_revenue_lakhs,
        recycling_rate,
        composting_rate,
        center_lat,
        center_lng
      `)
      .order('population_2024_est', { ascending: false })

    if (error) throw error

    // Get hotspot counts per district
    const { data: hotspotCounts } = await supabase
      .from('waste_hotspots')
      .select('district_code')
      .eq('status', 'active')

    const hotspotsByDistrict: Record<string, number> = {}
    ;(hotspotCounts || []).forEach((h) => {
      hotspotsByDistrict[h.district_code] = (hotspotsByDistrict[h.district_code] || 0) + 1
    })

    const enrichedDistricts = (districts || []).map((d) => ({
      ...d,
      active_hotspots: hotspotsByDistrict[d.district_code] || 0,
    }))

    // Aggregate state-level stats
    const stateStats = enrichedDistricts.reduce(
      (acc, d) => ({
        totalPopulation: acc.totalPopulation + (d.population_2024_est || 0),
        totalWasteTons: acc.totalWasteTons + (d.daily_waste_tons || 0),
        totalHouseholds: acc.totalHouseholds + (d.total_households || 0),
        totalCovered: acc.totalCovered + (d.households_covered || 0),
        totalWorkers: acc.totalWorkers + (d.active_workers || 0),
        totalRevenue: acc.totalRevenue + (d.annual_revenue_lakhs || 0),
        totalHotspots: acc.totalHotspots + (d.active_hotspots || 0),
      }),
      {
        totalPopulation: 0,
        totalWasteTons: 0,
        totalHouseholds: 0,
        totalCovered: 0,
        totalWorkers: 0,
        totalRevenue: 0,
        totalHotspots: 0,
      }
    )

    return NextResponse.json({
      success: true,
      districts: enrichedDistricts,
      stateStats,
    })
  } catch (err) {
    console.error('[admin/districts GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
