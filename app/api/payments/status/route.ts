/**
 * API Route: GET /api/payments/status
 * Purpose: Fetch municipal fee status for household
 * Features:
 *   - Current month payment status
 *   - Payment history
 *   - Outstanding balance calculation
 * Aligned with: SUCHITWA Mission (₹50/month household waste collection fee)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export type PaymentStatus = 'paid' | 'pending' | 'overdue' | 'waived'

export interface PaymentRecord {
  id: string
  month: number
  year: number
  amount: number
  status: PaymentStatus
  paid_at: string | null
  payment_method: string | null
  transaction_ref: string | null
}

export interface PaymentStatusResponse {
  success: boolean
  data?: {
    household_id: string
    current_month: {
      month: number
      year: number
      month_name: string
      amount: number
      status: PaymentStatus
      due_date: string
    }
    summary: {
      total_pending: number
      total_overdue: number
      total_paid_this_year: number
      last_payment_date: string | null
    }
    history: PaymentRecord[]
  }
  error?: string
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json<PaymentStatusResponse>(
        { success: false, error: 'Unauthorized. Please log in.' },
        { status: 401 }
      )
    }
    
    // Get user's household
    const { data: household, error: householdError } = await supabase
      .from('households')
      .select('id, verification_status')
      .eq('user_id', user.id)
      .single()
    
    if (householdError || !household) {
      return NextResponse.json<PaymentStatusResponse>(
        { success: false, error: 'No household registered. Please register your household first.' },
        { status: 404 }
      )
    }
    
    // Get current month/year
    const now = new Date()
    const currentMonth = now.getMonth() + 1 // JavaScript months are 0-indexed
    const currentYear = now.getFullYear()
    
    // Calculate due date (last day of current month)
    const dueDate = new Date(currentYear, currentMonth, 0)
    
    // Fetch current month's payment status
    const { data: currentPayment, error: currentError } = await supabase
      .from('user_payments')
      .select('*')
      .eq('household_id', household.id)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .single()
    
    // If no payment record exists for current month, it's pending
    const currentMonthStatus: PaymentStatus = currentPayment?.status || 'pending'
    const currentMonthAmount = currentPayment?.amount || 50.00 // Default SUCHITWA rate
    
    // Fetch payment history (last 12 months)
    const { data: payments, error: historyError } = await supabase
      .from('user_payments')
      .select('*')
      .eq('household_id', household.id)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(12)
    
    if (historyError) {
      console.error('Payment history fetch error:', historyError)
    }
    
    // Calculate summary statistics
    let totalPending = 0
    let totalOverdue = 0
    let totalPaidThisYear = 0
    let lastPaymentDate: string | null = null
    
    const history: PaymentRecord[] = (payments || []).map((payment) => {
      // Calculate totals
      if (payment.status === 'pending') {
        totalPending += parseFloat(payment.amount)
      } else if (payment.status === 'overdue') {
        totalOverdue += parseFloat(payment.amount)
      } else if (payment.status === 'paid' && payment.year === currentYear) {
        totalPaidThisYear += parseFloat(payment.amount)
        
        // Track most recent payment
        if (!lastPaymentDate || (payment.paid_at && payment.paid_at > lastPaymentDate)) {
          lastPaymentDate = payment.paid_at
        }
      }
      
      return {
        id: payment.id,
        month: payment.month,
        year: payment.year,
        amount: parseFloat(payment.amount),
        status: payment.status as PaymentStatus,
        paid_at: payment.paid_at,
        payment_method: payment.payment_method,
        transaction_ref: payment.transaction_ref
      }
    })
    
    // If current month not in history, add placeholder
    const hasCurrentMonth = history.some(p => p.month === currentMonth && p.year === currentYear)
    if (!hasCurrentMonth) {
      totalPending += 50.00 // Add current month's pending fee
    }
    
    return NextResponse.json<PaymentStatusResponse>({
      success: true,
      data: {
        household_id: household.id,
        current_month: {
          month: currentMonth,
          year: currentYear,
          month_name: MONTH_NAMES[currentMonth - 1],
          amount: currentMonthAmount,
          status: currentMonthStatus,
          due_date: dueDate.toISOString()
        },
        summary: {
          total_pending: totalPending,
          total_overdue: totalOverdue,
          total_paid_this_year: totalPaidThisYear,
          last_payment_date: lastPaymentDate
        },
        history
      }
    })
    
  } catch (error) {
    console.error('Payment status API error:', error)
    return NextResponse.json<PaymentStatusResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST endpoint for payment recording (admin/worker only)
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
    
    // Check if user is admin or worker
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_role')
      .eq('id', user.id)
      .single()
    
    if (profileError || !['admin', 'worker'].includes(profile?.user_role)) {
      return NextResponse.json(
        { success: false, error: 'Only administrators and workers can record payments' },
        { status: 403 }
      )
    }
    
    // Parse request body
    const body = await request.json()
    const { household_id, amount, month, year, payment_method, transaction_ref, notes } = body
    
    // Validate required fields
    if (!household_id || !amount || !month || !year) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: household_id, amount, month, year' },
        { status: 400 }
      )
    }
    
    // Record or update payment
    const { data: payment, error: insertError } = await supabase
      .from('user_payments')
      .upsert({
        household_id,
        amount,
        month,
        year,
        status: 'paid',
        payment_method: payment_method || 'cash',
        transaction_ref,
        paid_at: new Date().toISOString(),
        collected_by: user.id,
        notes
      }, {
        onConflict: 'household_id,month,year'
      })
      .select()
      .single()
    
    if (insertError) {
      console.error('Payment record error:', insertError)
      return NextResponse.json(
        { success: false, error: 'Failed to record payment' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      data: {
        payment_id: payment.id,
        message: 'Payment recorded successfully'
      }
    })
    
  } catch (error) {
    console.error('Payment POST API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
