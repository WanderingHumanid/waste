/**
 * Test endpoint to verify database connection
 * GET /api/test/db
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    tests: {}
  }

  try {
    const supabase = await createClient()
    
    // Test 1: Basic connection - try to query profiles table
    const { data: profilesCount, error: profilesError } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
    
    results.tests = {
      ...results.tests as object,
      profiles: profilesError ? { error: profilesError.message } : { status: 'ok', count: profilesCount }
    }

    // Test 2: Kerala districts table
    const { data: districts, error: districtsError } = await supabase
      .from('kerala_districts')
      .select('district_code, district_name')
      .limit(3)
    
    results.tests = {
      ...results.tests as object,
      kerala_districts: districtsError 
        ? { error: districtsError.message } 
        : { status: 'ok', sample: districts }
    }

    // Test 3: Wards table
    const { data: wards, error: wardsError } = await supabase
      .from('wards')
      .select('ward_number, ward_name')
      .limit(3)
    
    results.tests = {
      ...results.tests as object,
      wards: wardsError 
        ? { error: wardsError.message } 
        : { status: 'ok', sample: wards }
    }

    // Test 4: Hotspots table
    const { data: hotspots, error: hotspotsError } = await supabase
      .from('waste_hotspots')
      .select('id, hotspot_name, severity')
      .limit(3)
    
    results.tests = {
      ...results.tests as object,
      waste_hotspots: hotspotsError 
        ? { error: hotspotsError.message } 
        : { status: 'ok', sample: hotspots }
    }

    // Test 5: Households table
    const { data: households, error: householdsError } = await supabase
      .from('households')
      .select('id')
      .limit(1)
    
    results.tests = {
      ...results.tests as object,
      households: householdsError 
        ? { error: householdsError.message } 
        : { status: 'ok' }
    }

    // Overall status
    const tests = results.tests as Record<string, { error?: string }>
    results.overall = Object.values(tests).every(t => !t.error) ? 'ALL_PASSED' : 'SOME_FAILED'

    return NextResponse.json(results)
  } catch (error) {
    return NextResponse.json({
      ...results,
      overall: 'CONNECTION_ERROR',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
