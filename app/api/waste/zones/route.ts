import { NextRequest, NextResponse } from 'next/server'
import { getWasteEngine } from '@/lib/waste_engine'

export const runtime = 'nodejs'

let tickInterval: NodeJS.Timeout | null = null

function startBackgroundTick() {
  if (tickInterval) return

  const engine = getWasteEngine()
  tickInterval = setInterval(() => {
    engine.tick()
  }, 3000)
}

export async function GET(request: NextRequest) {
  try {
    startBackgroundTick()

    const engine = getWasteEngine()
    engine.tick()

    const zones = engine.getZones()

    return NextResponse.json({
      success: true,
      zones,
      timestamp: Date.now(),
    })
  } catch (error) {
    console.error('Error fetching zones:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch zones' },
      { status: 500 }
    )
  }
}
