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
    const district = searchParams.get('district') || 'all'

    // Get date ranges for trend calculation
    const now = new Date()
    const thisWeekStart = new Date(now)
    thisWeekStart.setDate(now.getDate() - 7)
    const lastWeekStart = new Date(now)
    lastWeekStart.setDate(now.getDate() - 14)

    // Parallel queries for all dashboard stats
    const [
      profilesRes,
      workersRes,
      signalsRes,
      householdsRes,
      paymentsRes,
      recentChangesRes,
      thisWeekUsersRes,
      lastWeekUsersRes,
      thisWeekSignalsRes,
      lastWeekSignalsRes,
    ] = await Promise.all([
      // Total users by role
      supabase.from('profiles').select('role', { count: 'exact' }),
      // Active workers count
      supabase.from('profiles').select('id', { count: 'exact' }).eq('role', 'worker'),
      // Pending signals
      supabase.from('signals').select('id, status, created_at, waste_types', { count: 'exact' })
        .in('status', ['pending', 'acknowledged'])
        .order('created_at', { ascending: false })
        .limit(100),
      // Households with waste ready
      supabase.from('households').select('id, waste_ready, ward_number', { count: 'exact' }),
      // Revenue (simplified - count of paid signals)
      supabase.from('signals').select('id', { count: 'exact' }).eq('status', 'collected'),
      // Recent admin activity
      supabase.from('admin_logs')
        .select('id, action_type, created_at, old_value, new_value')
        .order('created_at', { ascending: false })
        .limit(10),
      // This week user signups
      supabase.from('profiles').select('id', { count: 'exact' })
        .gte('created_at', thisWeekStart.toISOString()),
      // Last week user signups
      supabase.from('profiles').select('id', { count: 'exact' })
        .gte('created_at', lastWeekStart.toISOString())
        .lt('created_at', thisWeekStart.toISOString()),
      // This week signals
      supabase.from('signals').select('id', { count: 'exact' })
        .gte('created_at', thisWeekStart.toISOString()),
      // Last week signals  
      supabase.from('signals').select('id', { count: 'exact' })
        .gte('created_at', lastWeekStart.toISOString())
        .lt('created_at', thisWeekStart.toISOString()),
    ])

    const profiles = profilesRes.data || []
    const citizens = profiles.filter((p) => p.role === 'citizen').length
    const workers = workersRes.count || 0
    const admins = profiles.filter((p) => p.role === 'admin').length

    const pendingSignals = signalsRes.count || 0
    const totalHouseholds = householdsRes.count || 0
    const wasteReadyCount = (householdsRes.data || []).filter((h) => h.waste_ready).length
    const collectedCount = paymentsRes.count || 0

    // Calculate real trends
    const thisWeekUsers = thisWeekUsersRes.count || 0
    const lastWeekUsers = lastWeekUsersRes.count || 0
    const userTrend = thisWeekUsers - lastWeekUsers
    const userTrendPct = lastWeekUsers > 0 ? Math.round((userTrend / lastWeekUsers) * 100) : 0

    const thisWeekSignals = thisWeekSignalsRes.count || 0
    const lastWeekSignals = lastWeekSignalsRes.count || 0
    const signalTrend = lastWeekSignals > 0 ? Math.round(((thisWeekSignals - lastWeekSignals) / lastWeekSignals) * 100) : 0

    // Waste type breakdown from recent signals
    const wasteTypeMap: Record<string, number> = { wet: 0, dry: 0, hazardous: 0, recyclable: 0, 'e-waste': 0 }
    ;(signalsRes.data || []).forEach((s) => {
      if (Array.isArray(s.waste_types)) {
        s.waste_types.forEach((wt: string) => {
          if (wt in wasteTypeMap) wasteTypeMap[wt]++
        })
      }
    })

    // Daily signal counts for last 7 days with smart prediction
    const weeklyData = Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      const dateStr = d.toISOString().split('T')[0]
      const dayOfWeek = d.getDay()
      const actual = (signalsRes.data || []).filter(
        (s) => s.created_at?.startsWith(dateStr)
      ).length
      
      // Simple prediction: weekends have ~30% more, weekdays are baseline
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
      const baselineAvg = Math.max(1, Math.round(thisWeekSignals / 7))
      const predicted = isWeekend 
        ? Math.round(baselineAvg * 1.3)  // 30% higher on weekends
        : baselineAvg
      
      return {
        date: dateStr,
        day: d.toLocaleDateString('en-IN', { weekday: 'short' }),
        actual,
        predicted,
      }
    })

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers: profiles.length,
        citizens,
        workers,
        admins,
        pendingSignals,
        totalHouseholds,
        wasteReadyCount,
        collectedCount,
        revenueEstimate: collectedCount * 45, // ₹45 per collection
        wasteTypeBreakdown: wasteTypeMap,
        weeklyTrend: weeklyData,
        recentActivity: recentChangesRes.data || [],
        // Real trend data
        userTrend,
        userTrendPct,
        signalTrend,
        thisWeekUsers,
        thisWeekSignals,
      },
    })
  } catch (err) {
    console.error('[admin/stats]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
