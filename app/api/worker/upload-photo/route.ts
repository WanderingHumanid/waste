import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function requireWorker(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  return profile?.role === 'worker' || profile?.role === 'admin' ? user : null
}

// POST /api/worker/upload-photo — upload household verification photo with GPS
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const worker = await requireWorker(supabase)
    if (!worker) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const photo = formData.get('photo') as File | null
    const householdId = formData.get('householdId') as string
    const lat = parseFloat(formData.get('lat') as string)
    const lng = parseFloat(formData.get('lng') as string)
    const accuracy = parseFloat(formData.get('accuracy') as string || '0')
    const altitude = parseFloat(formData.get('altitude') as string || '0') || null
    const heading = parseFloat(formData.get('heading') as string || '0') || null
    const notes = (formData.get('notes') as string) || ''

    if (!photo || !householdId || isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { error: 'Missing required fields: photo, householdId, lat, lng' },
        { status: 400 }
      )
    }

    // Verify household exists
    const { data: household, error: householdError } = await supabase
      .from('households')
      .select('id, address')
      .eq('id', householdId)
      .single()

    if (householdError || !household) {
      return NextResponse.json({ error: 'Household not found' }, { status: 404 })
    }

    // Upload photo to Supabase Storage
    const timestamp = Date.now()
    const fileName = `household_${householdId}/${worker.id}_${timestamp}.jpg`
    const fileBuffer = await photo.arrayBuffer()

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('household-photos')
      .upload(fileName, fileBuffer, {
        contentType: 'image/jpeg',
        upsert: false,
      })

    if (uploadError) {
      console.error('[upload-photo] Storage error:', uploadError)
      // If bucket doesn't exist, try creating a signed URL from temp storage
      return NextResponse.json({ error: 'Storage upload failed' }, { status: 500 })
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('household-photos')
      .getPublicUrl(fileName)

    const photoUrl = urlData?.publicUrl || ''

    // Insert record into household_photos table
    const { error: insertError } = await supabase
      .from('household_photos')
      .insert({
        household_id: householdId,
        worker_id: worker.id,
        photo_url: photoUrl,
        photo_type: 'verification',
        capture_lat: lat,
        capture_lng: lng,
        capture_accuracy_m: accuracy,
        capture_altitude_m: altitude,
        capture_heading: heading,
        notes: notes || null,
        is_synced: true,
        synced_at: new Date().toISOString(),
      })

    if (insertError) {
      console.error('[upload-photo] DB insert error:', insertError)
      // Still return success if photo uploaded but DB insert failed
      // The photo exists in storage
    }

    // Update household to mark as photo-verified if needed
    await supabase
      .from('households')
      .update({
        is_verified: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', householdId)
      .is('is_verified', false) // Only update if not already verified

    return NextResponse.json({
      success: true,
      photoUrl,
      message: 'Photo uploaded successfully',
    })
  } catch (err) {
    console.error('[upload-photo] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/worker/upload-photo — get photos for a household
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const worker = await requireWorker(supabase)
    if (!worker) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const householdId = searchParams.get('householdId')

    if (!householdId) {
      return NextResponse.json({ error: 'householdId required' }, { status: 400 })
    }

    const { data: photos, error } = await supabase
      .from('household_photos')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) throw error

    return NextResponse.json({
      success: true,
      photos: photos || [],
    })
  } catch (err) {
    console.error('[upload-photo GET] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
