/**
 * API Route: POST /api/households/establish
 * Purpose: Create or update household location via GPS pin-drop
 * Converts lat/lng to PostGIS POINT geometry and upserts household record
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface EstablishHouseholdRequest {
  lat: number
  lng: number
  nickname?: string
  manualAddress?: string
  geocodedAddress?: string
  wardNumber?: number | null
}

export interface EstablishHouseholdResponse {
  success: boolean
  data?: {
    household_id: string
    nickname: string
    location: {
      lat: number
      lng: number
    }
    ward_number: number | null
    manual_address: string | null
    geocoded_address: string | null
    waste_ready: boolean
    created: boolean // true if new, false if updated
  }
  error?: string
}

// Validate coordinates are within reasonable bounds
function validateCoordinates(lat: number, lng: number): boolean {
  // Lat must be between -90 and 90
  // Lng must be between -180 and 180
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

// Validate ward number for Piravom (1-19)
function validateWard(ward: number | null | undefined): boolean {
  if (ward === null || ward === undefined) return true
  return ward >= 1 && ward <= 19
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json<EstablishHouseholdResponse>(
        { success: false, error: 'Unauthorized. Please log in.' },
        { status: 401 }
      )
    }

    // Parse request body
    const body: EstablishHouseholdRequest = await request.json()
    const { lat, lng, nickname, manualAddress, geocodedAddress, wardNumber } = body

    // Validate required fields
    if (lat === undefined || lng === undefined) {
      return NextResponse.json<EstablishHouseholdResponse>(
        { success: false, error: 'Latitude and longitude are required.' },
        { status: 400 }
      )
    }

    // Validate coordinates
    if (!validateCoordinates(lat, lng)) {
      return NextResponse.json<EstablishHouseholdResponse>(
        { success: false, error: 'Invalid coordinates. Latitude must be -90 to 90, longitude -180 to 180.' },
        { status: 400 }
      )
    }

    // Validate ward number
    if (!validateWard(wardNumber)) {
      return NextResponse.json<EstablishHouseholdResponse>(
        { success: false, error: 'Invalid ward number. Must be between 1 and 55.' },
        { status: 400 }
      )
    }

    // Convert to WKT (Well-Known Text) format for PostGIS
    // Format: POINT(longitude latitude) - note: lng comes first in WKT!
    const locationWKT = `POINT(${lng} ${lat})`

    // Check if household already exists for this user
    const { data: existingHousehold } = await supabase
      .from('households')
      .select('id')
      .eq('user_id', user.id)
      .single()

    let result
    let isCreated = false

    if (existingHousehold) {
      // Update existing household
      const { data, error } = await supabase
        .from('households')
        .update({
          location: locationWKT,
          nickname: nickname || 'My House',
          manual_address: manualAddress || null,
          geocoded_address: geocodedAddress || null,
          ward_number: wardNumber || null,
          location_updated_at: new Date().toISOString(),
        })
        .eq('id', existingHousehold.id)
        .select()
        .single()

      if (error) {
        console.error('Error updating household:', error)
        return NextResponse.json<EstablishHouseholdResponse>(
          { success: false, error: 'Failed to update household location.' },
          { status: 500 }
        )
      }
      result = data
    } else {
      // Create new household
      isCreated = true
      const { data, error } = await supabase
        .from('households')
        .insert({
          user_id: user.id,
          location: locationWKT,
          nickname: nickname || 'My House',
          manual_address: manualAddress || null,
          geocoded_address: geocodedAddress || null,
          ward_number: wardNumber || null,
          waste_ready: false,
          location_updated_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating household:', error)
        return NextResponse.json<EstablishHouseholdResponse>(
          { success: false, error: 'Failed to create household.' },
          { status: 500 }
        )
      }
      result = data
    }

    return NextResponse.json<EstablishHouseholdResponse>({
      success: true,
      data: {
        household_id: result.id,
        nickname: result.nickname || 'My House',
        location: { lat, lng },
        ward_number: result.ward_number,
        manual_address: result.manual_address,
        geocoded_address: result.geocoded_address,
        waste_ready: result.waste_ready || false,
        created: isCreated,
      },
    })
  } catch (error) {
    console.error('Establish household error:', error)
    return NextResponse.json<EstablishHouseholdResponse>(
      { success: false, error: 'Internal server error.' },
      { status: 500 }
    )
  }
}

// GET endpoint to fetch current household location
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Please log in.' },
        { status: 401 }
      )
    }

    // Fetch household
    const { data: household, error } = await supabase
      .from('households')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching household:', error)
      return NextResponse.json(
        { success: false, error: `Failed to fetch household. [${error.code}] ${error.message}` },
        { status: 500 }
      )
    }

    if (!household) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No household found. Please set up your location.',
      })
    }

    // Parse location from PostGIS - handle multiple formats
    let lat = 0, lng = 0
    if (household.location) {
      const location = household.location
      if (typeof location === 'string') {
        // Try WKT format: POINT(lng lat)
        const wktMatch = location.match(/POINT\\s*\\(\\s*([\\d.-]+)\\s+([\\d.-]+)\\s*\\)/i)
        if (wktMatch) {
          lng = parseFloat(wktMatch[1])
          lat = parseFloat(wktMatch[2])
        } else if (location.startsWith('01') && location.length >= 50) {
          // WKB hex format (PostGIS default)
          // Format: byte order (2) + type (8) + SRID (8) + X (16) + Y (16)
          try {
            const hexToDouble = (hex: string) => {
              const bytes = new Uint8Array(8)
              for (let i = 0; i < 8; i++) {
                bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
              }
              const buffer = bytes.buffer
              const view = new DataView(buffer)
              return view.getFloat64(0, true) // little-endian
            }
            // Skip: byte order (2) + type (8) + SRID (8) = 18 chars
            const xHex = location.substring(18, 34)
            const yHex = location.substring(34, 50)
            lng = hexToDouble(xHex)
            lat = hexToDouble(yHex)
          } catch (e) {
            console.error('Failed to parse WKB hex:', e)
          }
        }
      } else if (typeof location === 'object' && location !== null) {
        if (location.coordinates && Array.isArray(location.coordinates)) {
          lng = location.coordinates[0]
          lat = location.coordinates[1]
        } else if ('x' in location && 'y' in location) {
          lng = (location as { x: number; y: number }).x
          lat = (location as { x: number; y: number }).y
        }
      }
    }
    
    console.log('Parsed household location:', { lat, lng, raw: household.location })

    return NextResponse.json({
      success: true,
      data: {
        household_id: household.id,
        nickname: household.nickname || 'My House',
        location: { lat, lng },
        ward_number: household.ward_number,
        manual_address: household.manual_address,
        geocoded_address: household.geocoded_address,
        waste_ready: household.waste_ready || false,
        location_updated_at: household.location_updated_at,
      },
    })
  } catch (error) {
    console.error('Get household error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error.' },
      { status: 500 }
    )
  }
}

// PATCH endpoint to toggle waste_ready status (Digital Bell)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Please log in.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { waste_ready, waste_types } = body

    if (typeof waste_ready !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'waste_ready must be a boolean value.' },
        { status: 400 }
      )
    }

    // Validate waste_types if provided
    const validWasteTypes = ['wet', 'dry', 'recyclable', 'hazardous', 'e-waste', 'mixed']
    const cleanedWasteTypes = Array.isArray(waste_types) 
      ? waste_types.filter(t => validWasteTypes.includes(t))
      : ['mixed']

    // Update waste_ready status
    const { data, error } = await supabase
      .from('households')
      .update({ 
        waste_ready,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .select('id, waste_ready, ward_number, district, nickname')
      .single()

    if (error) {
      console.error('Error updating waste_ready:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to update waste ready status.' },
        { status: 500 }
      )
    }

    // === CRITICAL: Create or update signal record ===
    // This is what makes the signal visible to admin and workers
    if (waste_ready) {
      // Check if there's already an active signal for this household
      const { data: existingSignal } = await supabase
        .from('signals')
        .select('id')
        .eq('household_id', data.id)
        .in('status', ['pending', 'acknowledged'])
        .single()

      if (!existingSignal) {
        // Create new signal with waste types
        const { error: signalError } = await supabase
          .from('signals')
          .insert({
            household_id: data.id,
            user_id: user.id,
            status: 'pending',
            waste_types: cleanedWasteTypes,
            created_at: new Date().toISOString(),
          })

        if (signalError) {
          console.error('Error creating signal:', signalError)
          // Non-blocking - household is already updated
        } else {
          console.log('Signal created for household:', data.id, 'waste types:', cleanedWasteTypes)
        }
      } else {
        // Update existing signal with new waste types
        await supabase
          .from('signals')
          .update({ waste_types: cleanedWasteTypes, updated_at: new Date().toISOString() })
          .eq('id', existingSignal.id)
      }
    } else {
      // User cancelled - update any pending signals to cancelled
      const { error: cancelError } = await supabase
        .from('signals')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('household_id', data.id)
        .in('status', ['pending', 'acknowledged'])

      if (cancelError) {
        console.error('Error cancelling signals:', cancelError)
      }
    }

    // Broadcast to ward-specific channel for worker radar
    // This supplements the pg_notify trigger for real-time updates
    if (data.ward_number) {
      const channel = `ward:${data.district || 'Ernakulam'}:${data.ward_number}`
      await supabase
        .channel(channel)
        .send({
          type: 'broadcast',
          event: 'digital_bell',
          payload: {
            household_id: data.id,
            waste_ready: data.waste_ready,
            nickname: data.nickname,
            ward_number: data.ward_number,
            timestamp: new Date().toISOString(),
          },
        })
        .catch(console.error) // Non-blocking
    }

    return NextResponse.json({
      success: true,
      data: {
        household_id: data.id,
        waste_ready: data.waste_ready,
        ward_number: data.ward_number,
      },
      message: waste_ready 
        ? 'Digital Bell activated! Workers in your ward have been notified.'
        : 'Waste ready status cancelled.',
    })
  } catch (error) {
    console.error('Toggle waste_ready error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error.' },
      { status: 500 }
    )
  }
}
