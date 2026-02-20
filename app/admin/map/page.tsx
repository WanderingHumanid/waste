'use client'

import { WasteMapWrapper } from '@/components/waste/waste-map-wrapper'

export default function AdminMapPage() {
  return (
    <div className="space-y-4 max-w-full h-[calc(100vh-8rem)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-zinc-900">Geospatial Intelligence</h2>
          <p className="text-sm text-zinc-500">
            Real-time waste signals + ML-predicted hotspots
          </p>
        </div>
      </div>
      <div className="flex-1 rounded-xl overflow-hidden border border-zinc-200 shadow-sm min-h-[500px] h-full">
        <WasteMapWrapper />
      </div>
    </div>
  )
}
