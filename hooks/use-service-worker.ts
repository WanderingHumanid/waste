'use client'

import { useEffect, useState, useCallback } from 'react'

interface CacheStats {
  [key: string]: number
}

interface MapCacheProgress {
  cached: number
  total: number
}

export function useServiceWorker() {
  const [isSupported, setIsSupported] = useState(false)
  const [isRegistered, setIsRegistered] = useState(false)
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null)
  const [mapCacheProgress, setMapCacheProgress] = useState<MapCacheProgress | null>(null)

  // Register service worker
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    setIsSupported(true)

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[SW] Registered:', reg.scope)
        setRegistration(reg)
        setIsRegistered(true)
      })
      .catch((err) => {
        console.error('[SW] Registration failed:', err)
      })

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data.type === 'MAP_CACHE_COMPLETE') {
        setMapCacheProgress({
          cached: event.data.cached,
          total: event.data.total,
        })
      }
    })
  }, [])

  // Get cache stats
  const getCacheStats = useCallback(async () => {
    const activeWorker = registration?.active
    if (!activeWorker) return null

    return new Promise<CacheStats>((resolve) => {
      const channel = new MessageChannel()
      channel.port1.onmessage = (event) => {
        setCacheStats(event.data)
        resolve(event.data)
      }
      activeWorker.postMessage({ type: 'GET_CACHE_STATS' }, [channel.port2])
    })
  }, [registration])

  // Cache map area for offline use
  const cacheMapArea = useCallback(
    (bounds: { north: number; south: number; east: number; west: number }, zoom: number = 16) => {
      if (!registration?.active) return false
      
      setMapCacheProgress({ cached: 0, total: -1 }) // -1 indicates loading
      
      registration.active.postMessage({
        type: 'CACHE_MAP_AREA',
        bounds,
        zoom,
      })
      
      return true
    },
    [registration]
  )

  // Clear map cache
  const clearMapCache = useCallback(() => {
    if (!registration?.active) return false
    
    registration.active.postMessage({ type: 'CLEAR_MAP_CACHE' })
    setMapCacheProgress(null)
    
    return true
  }, [registration])

  // Skip waiting and activate new service worker
  const skipWaiting = useCallback(() => {
    if (!registration?.waiting) return false
    
    registration.waiting.postMessage({ type: 'SKIP_WAITING' })
    
    return true
  }, [registration])

  return {
    isSupported,
    isRegistered,
    registration,
    cacheStats,
    mapCacheProgress,
    getCacheStats,
    cacheMapArea,
    clearMapCache,
    skipWaiting,
  }
}

// Piravom area bounds (Ernakulam district)
export const PIRAVOM_BOUNDS = {
  north: 9.92,
  south: 9.83,
  east: 76.55,
  west: 76.43,
}

// Ernakulam/Kochi area bounds
export const ERNAKULAM_BOUNDS = {
  north: 10.12,
  south: 9.85,
  east: 76.42,
  west: 76.15,
}

// Kerala state bounds
export const KERALA_BOUNDS = {
  north: 12.8,
  south: 8.18,
  east: 77.42,
  west: 74.85,
}
