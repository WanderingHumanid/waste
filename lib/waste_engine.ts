export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface Zone {
  id: string
  name: string
  lat: number
  lon: number
  bin_capacity: number
  generation_rate: number
  last_collection_time: number
  current_fill: number
}

export interface ZoneState extends Zone {
  fill_percentage: number
  risk_level: RiskLevel
  hotspot_score: number
  predicted_overflow_minutes: number | null
}

interface ZoneData {
  [key: string]: Zone
}

export class WasteEngine {
  private zones: ZoneData = {}
  private last_tick: number = Date.now()

  constructor() {
    this.last_tick = Date.now()
    this.initializeZones()
  }

  private initializeZones() {
    // Sample update: node coordinates snapped to real road locations (OpenStreetMap reference)
    const piravomZones = [
      { id: 'zone_001', name: 'Piravom Central Bus Stand', lat: 9.8640844, lon: 76.513132, bin_capacity: 800, generation_rate: 0.148 },
      { id: 'zone_002', name: 'Kalampoor Junction', lat: 9.8668764, lon: 76.5065807, bin_capacity: 750, generation_rate: 0.138 },
      { id: 'zone_003', name: 'Pazhoor Temple Road', lat: 9.868886, lon: 76.5021146, bin_capacity: 900, generation_rate: 0.167 },
      { id: 'zone_004', name: 'Kakkad South Market', lat: 9.8716402, lon: 76.4974814, bin_capacity: 700, generation_rate: 0.130 },
      { id: 'zone_005', name: 'Mulakulam Border', lat: 9.8742306, lon: 76.4943236, bin_capacity: 650, generation_rate: 0.120 },
      { id: 'zone_006', name: 'Maneed Panchayat Office', lat: 9.8733934, lon: 76.4878778, bin_capacity: 600, generation_rate: 0.111 },
      { id: 'zone_007', name: 'Pampakuda Main Junction', lat: 9.8780133, lon: 76.484395, bin_capacity: 850, generation_rate: 0.157 },
      { id: 'zone_008', name: 'Namakuzhy High School', lat: 9.8804917, lon: 76.4809567, bin_capacity: 500, generation_rate: 0.093 },
      { id: 'zone_009', name: 'Veliyanad Center', lat: 9.8832796, lon: 76.4769612, bin_capacity: 700, generation_rate: 0.130 },
      { id: 'zone_010', name: 'Kochupilly Road', lat: 9.8840637, lon: 76.4729282, bin_capacity: 450, generation_rate: 0.083 },
      { id: 'zone_011', name: 'Peppathy Junction', lat: 9.8838035, lon: 76.4688321, bin_capacity: 480, generation_rate: 0.089 },
      { id: 'zone_012', name: 'Government Hospital Piravom', lat: 9.8627133, lon: 76.5261783, bin_capacity: 550, generation_rate: 0.102 },
    ]

    const now = Date.now()

    piravomZones.forEach((zone) => {
      this.zones[zone.id] = {
        ...zone,
        last_collection_time: now - 120 * 60 * 1000,
        current_fill: Math.random() * zone.bin_capacity * 0.3,
      }
    })
  }

  tick() {
    const now = Date.now()
    const elapsed_ms = now - this.last_tick
    const elapsed_minutes = elapsed_ms / (1000 * 60)

    for (const zone_id in this.zones) {
      const zone = this.zones[zone_id]
      zone.current_fill = Math.min(
        zone.bin_capacity,
        zone.current_fill + zone.generation_rate * elapsed_minutes
      )
    }

    this.last_tick = now
  }

  collect(zone_id: string, amount: number) {
    if (!this.zones[zone_id]) {
      throw new Error(`Zone ${zone_id} not found`)
    }

    const zone = this.zones[zone_id]
    zone.current_fill = Math.max(0, zone.current_fill - amount)
    zone.last_collection_time = Date.now()
  }

  getZones(): ZoneState[] {
    const now = Date.now()

    return Object.values(this.zones).map((zone) => {
      const fill_percentage = (zone.current_fill / zone.bin_capacity) * 100
      const risk_level = this.calculateRiskLevel(fill_percentage)
      const time_since_collection = (now - zone.last_collection_time) / (1000 * 60)

      const hotspot_score = fill_percentage * time_since_collection
      const predicted_overflow_minutes =
        zone.generation_rate > 0
          ? (zone.bin_capacity - zone.current_fill) / zone.generation_rate
          : null

      return {
        ...zone,
        fill_percentage: Math.round(fill_percentage * 10) / 10,
        risk_level,
        hotspot_score,
        predicted_overflow_minutes:
          predicted_overflow_minutes !== null
            ? Math.round(predicted_overflow_minutes)
            : null,
      }
    })
  }

  getHotspots(k: number = 5): ZoneState[] {
    return this.getZones()
      .sort((a, b) => b.hotspot_score - a.hotspot_score)
      .slice(0, k)
  }

  private calculateRiskLevel(fill_percentage: number): RiskLevel {
    if (fill_percentage < 40) return 'LOW'
    if (fill_percentage < 70) return 'MEDIUM'
    if (fill_percentage < 90) return 'HIGH'
    return 'CRITICAL'
  }
}

let engineInstance: WasteEngine | null = null

export function getWasteEngine(): WasteEngine {
  if (!engineInstance) {
    engineInstance = new WasteEngine()
  }
  return engineInstance
}

export function resetWasteEngine() {
  engineInstance = null
}
