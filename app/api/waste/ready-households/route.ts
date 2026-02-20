/**
 * GET /api/waste/ready-households
 * Fetches all households with waste_ready=true from Supabase
 * Returns them in a format compatible with the route optimizer (ZoneState shape)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

interface HouseholdSignal {
  id: string
  name: string
  lat: number
  lon: number
  fill_percentage: number
  risk_level: 'CRITICAL'
  hotspot_score: number
  predicted_overflow_minutes: number | null
  bin_capacity: number
  generation_rate: number
  last_collection_time: number
  current_fill: number
  is_household_signal: true
  household_id: string
  nickname: string
  ward_number: number | null
  waste_types?: string[]
}

// Parse PostGIS location from various formats
function parseLocation(location: unknown): { lat: number; lng: number } | null {
  if (!location) return null

  if (typeof location === 'string') {
    // WKT format: POINT(lng lat)
    const wktMatch = location.match(/POINT\s*\(\s*([\d.-]+)\s+([\d.-]+)\s*\)/i)
    if (wktMatch) {
      return { lng: parseFloat(wktMatch[1]), lat: parseFloat(wktMatch[2]) }
    }

    // WKB hex format (PostGIS default)
    if (location.startsWith('01') && location.length >= 50) {
      try {
        const hexToDouble = (hex: string) => {
          const bytes = new Uint8Array(8)
          for (let i = 0; i < 8; i++) {
            bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
          }
          const buffer = bytes.buffer
          const view = new DataView(buffer)
          return view.getFloat64(0, true)
        }
        const xHex = location.substring(18, 34)
        const yHex = location.substring(34, 50)
        return { lng: hexToDouble(xHex), lat: hexToDouble(yHex) }
      } catch {
        return null
      }
    }
  }

  if (typeof location === 'object' && location !== null) {
    const loc = location as Record<string, unknown>
    if (loc.coordinates && Array.isArray(loc.coordinates)) {
      return { lng: loc.coordinates[0] as number, lat: loc.coordinates[1] as number }
    }
    if ('x' in loc && 'y' in loc) {
      return { lng: loc.x as number, lat: loc.y as number }
    }
  }

  return null
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Fetch all waste-ready households with their signals
    const { data: households, error } = await supabase
      .from('households')
      .select(`
        id,
        user_id,
        nickname,
        ward_number,
        waste_ready,
        location,
        manual_address,
        geocoded_address,
        signals (
          id,
          waste_types,
          status,
          created_at
        )
      `)
      .eq('waste_ready', true)

    if (error) {
      console.error('Error fetching ready households:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch ready households' },
        { status: 500 }
      )
    }

    const now = Date.now()
    const signals: HouseholdSignal[] = []

    for (const household of households || []) {
      const coords = parseLocation(household.location)
      if (!coords || (coords.lat === 0 && coords.lng === 0)) continue

      // Get active signal info
      const activeSignal = Array.isArray(household.signals)
        ? household.signals.find((s: Record<string, unknown>) =>
            s.status === 'pending' || s.status === 'acknowledged'
          )
        : null

      signals.push({
        id: `household_${household.id}`,
        name: household.nickname || 'Household Pickup',
        lat: coords.lat,
        lon: coords.lng,
        fill_percentage: 100, // Max urgency - user explicitly said they're ready
        risk_level: 'CRITICAL',
        hotspot_score: 99999, // Highest priority
        predicted_overflow_minutes: 0, // Immediate attention needed
        bin_capacity: 100,
        generation_rate: 0,
        last_collection_time: now - 180 * 60 * 1000,
        current_fill: 100,
        is_household_signal: true,
        household_id: household.id,
        nickname: household.nickname || 'Household',
        ward_number: household.ward_number,
        waste_types: activeSignal?.waste_types || [],
      })
    }

    return NextResponse.json({
      success: true,
      signals,
      count: signals.length,
      timestamp: now,
    })
  } catch (error) {
    console.error('Ready households error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
