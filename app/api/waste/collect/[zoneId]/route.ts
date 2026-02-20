import { NextRequest, NextResponse } from 'next/server'
import { getWasteEngine } from '@/lib/waste_engine'

export const runtime = 'nodejs'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ zoneId: string }> }
) {
  try {
    const { zoneId } = await context.params
    const body = await request.json()
    const { amount = 100 } = body

    // Household signals are not in the WasteEngine — handle separately
    if (zoneId.startsWith('household_')) {
      return NextResponse.json({
        success: true,
        message: `Household pickup confirmed for ${zoneId}`,
        zone: null,
        isHousehold: true,
        timestamp: Date.now(),
      })
    }

    const engine = getWasteEngine()
    engine.tick()
    engine.collect(zoneId, amount)

    const zones = engine.getZones()
    const collectedZone = zones.find((z) => z.id === zoneId)

    return NextResponse.json({
      success: true,
      message: `Collected ${amount}kg from ${zoneId}`,
      zone: collectedZone,
      timestamp: Date.now(),
    })
  } catch (error) {
    console.error('Error collecting waste:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Collection failed',
      },
      { status: 500 }
    )
  }
}
