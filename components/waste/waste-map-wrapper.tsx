'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'

const WasteMapComponent = dynamic(
  () => import('./waste-map').then((mod) => ({ default: mod.WasteMap })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    ),
  }
)

export function WasteMapWrapper() {
  return (
    <Suspense
      fallback={
        <div className="w-full h-screen flex items-center justify-center bg-zinc-50">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
        </div>
      }
    >
      <WasteMapComponent />
    </Suspense>
  )
}
