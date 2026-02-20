'use client'

import { Skeleton } from '@/components/ui/skeleton'

export default function PredictionsLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-6 w-56 mb-2" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-zinc-200 p-4">
            <div className="flex items-center gap-4">
              <Skeleton className="w-12 h-12 rounded-xl" />
              <div>
                <Skeleton className="h-7 w-12 mb-1" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        <Skeleton className="h-5 w-48 mb-4" />
        <Skeleton className="h-72 w-full rounded-lg" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        <Skeleton className="h-5 w-40 mb-4" />
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}
