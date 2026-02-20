'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { Map } from 'lucide-react'

export default function MapLoading() {
  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-28" />
      </div>

      {/* Map placeholder */}
      <div className="h-[calc(100vh-200px)] min-h-[400px] bg-zinc-900 rounded-xl flex items-center justify-center">
        <div className="text-center">
          <Map className="w-12 h-12 text-zinc-700 mx-auto mb-3 animate-pulse" />
          <p className="text-zinc-500 text-sm">Loading map...</p>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-16 flex-1 rounded-lg" />
        ))}
      </div>
    </div>
  )
}
