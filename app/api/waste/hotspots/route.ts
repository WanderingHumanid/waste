import { NextRequest, NextResponse } from 'next/server'
import { getWasteEngine } from '@/lib/waste_engine'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const engine = getWasteEngine()
    engine.tick()

    const hotspots = engine.getHotspots(5)

    return NextResponse.json({
      success: true,
      hotspots,
      timestamp: Date.now(),
    })
  } catch (error) {
    console.error('Error fetching hotspots:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch hotspots' },
      { status: 500 }
    )
  }
}
