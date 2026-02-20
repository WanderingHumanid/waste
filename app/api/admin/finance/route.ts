import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    try {
        const supabase = await createClient()
        const { searchParams } = new URL(request.url)
        const district = searchParams.get('district') || 'Ernakulam'

        // 1. Fetch Revenue Metrics (from user_payments)
        const { data: payments, error: paymentsError } = await supabase
            .from('user_payments')
            .select('amount, status, paid_at, households(district)')
            .eq('households.district', district)

        if (paymentsError) throw paymentsError

        const totalRevenue = payments
            ?.filter(p => p.status === 'paid')
            .reduce((sum, p) => sum + Number(p.amount), 0) || 0

        const pendingRevenue = payments
            ?.filter(p => p.status === 'pending')
            .reduce((sum, p) => sum + Number(p.amount), 0) || 0

        // 2. Fetch District Waste Stats for expense/revenue history
        const { data: stats, error: statsError } = await supabase
            .from('district_waste_stats')
            .select('*')
            // .eq('district_code', 'EKM') // Hardcoded for demo if needed, but better to use district lookup
            .order('stat_date', { ascending: false })
            .limit(30)

        if (statsError) throw statsError

        // 3. Get Green Credits total
        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('green_credits')

        if (profilesError) throw profilesError

        const totalCredits = profiles?.reduce((sum, p) => sum + (p.green_credits || 0), 0) || 0

        return NextResponse.json({
            summary: {
                totalRevenue,
                pendingRevenue,
                totalCredits,
                collectionRate: payments?.length ? (payments.filter(p => p.status === 'paid').length / payments.length) * 100 : 0
            },
            recentPayments: payments?.slice(0, 10) || [],
            trends: stats || []
        })
    } catch (error: any) {
        console.error('Finance API Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
