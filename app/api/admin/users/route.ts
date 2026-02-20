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

// GET /api/admin/users — paginated, searchable user list
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const admin = await requireAdmin(supabase)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const role = searchParams.get('role') || 'all'
    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabase
      .from('profiles')
      .select('id, role, full_name, phone, green_credits, created_at, preferred_language', {
        count: 'exact',
      })
      .range(from, to)
      .order('created_at', { ascending: false })

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`)
    }

    if (role !== 'all') {
      query = query.eq('role', role)
    }

    const { data, count, error } = await query

    if (error) throw error

    // Fetch household wards for workers
    const workerIds = (data || []).filter((u) => u.role === 'worker').map((u) => u.id)
    let workerAssignments: Record<string, { ward_number: number | null; district: string | null }> = {}
    if (workerIds.length > 0) {
      const { data: assignments } = await supabase
        .from('worker_assignments')
        .select('worker_id, ward_number, district')
        .in('worker_id', workerIds)
        .eq('is_active', true)
      ;(assignments || []).forEach((a) => {
        workerAssignments[a.worker_id] = { ward_number: a.ward_number, district: a.district }
      })
    }

    const users = (data || []).map((u) => ({
      ...u,
      assignment: workerAssignments[u.id] || null,
    }))

    return NextResponse.json({
      success: true,
      users,
      total: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / limit),
    })
  } catch (err) {
    console.error('[admin/users GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/admin/users — update role, assign ward
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const admin = await requireAdmin(supabase)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { userId, action, newRole, wardNumber, district } = body

    if (!userId || !action) {
      return NextResponse.json({ error: 'userId and action are required' }, { status: 400 })
    }

    // Fetch current user for audit
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', userId)
      .single()

    if (action === 'set_role') {
      if (!['citizen', 'worker', 'admin'].includes(newRole)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
      }
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('id', userId)
      if (updateError) throw updateError

      // Log the action
      await supabase.from('admin_logs').insert({
        admin_id: admin.id,
        action_type: 'role_change',
        target_user_id: userId,
        target_entity: 'profiles',
        old_value: { role: currentProfile?.role },
        new_value: { role: newRole },
        notes: `Role changed from ${currentProfile?.role} to ${newRole} for ${currentProfile?.full_name}`,
      })

      return NextResponse.json({ success: true, message: `Role updated to ${newRole}` })
    }

    if (action === 'assign_ward') {
      if (!wardNumber) return NextResponse.json({ error: 'wardNumber required' }, { status: 400 })

      const { error: upsertError } = await supabase
        .from('worker_assignments')
        .upsert(
          {
            worker_id: userId,
            ward_number: wardNumber,
            district: district || 'Ernakulam',
            assigned_by: admin.id,
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'worker_id' }
        )
      if (upsertError) throw upsertError

      await supabase.from('admin_logs').insert({
        admin_id: admin.id,
        action_type: 'ward_assignment',
        target_user_id: userId,
        target_entity: 'worker_assignments',
        old_value: null,
        new_value: { ward_number: wardNumber, district },
        notes: `Worker ${currentProfile?.full_name} assigned to Ward ${wardNumber}`,
      })

      return NextResponse.json({ success: true, message: `Worker assigned to Ward ${wardNumber}` })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    console.error('[admin/users PATCH]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
