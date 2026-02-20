'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Download,
  Trash2,
  MapPin,
  Wifi,
  WifiOff,
  HardDrive,
  CheckCircle2,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useServiceWorker, PIRAVOM_BOUNDS, ERNAKULAM_BOUNDS } from '@/hooks/use-service-worker'
import { toast } from 'sonner'

interface OfflineSettingsProps {
  wardNumber?: number
  district?: string
}

export function OfflineSettings({ wardNumber, district }: OfflineSettingsProps) {
  const {
    isSupported,
    isRegistered,
    cacheStats,
    mapCacheProgress,
    getCacheStats,
    cacheMapArea,
    clearMapCache,
  } = useServiceWorker()

  const [isOnline, setIsOnline] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [clearing, setClearing] = useState(false)

  // Check online status
  useEffect(() => {
    setIsOnline(navigator.onLine)
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Fetch cache stats on mount
  useEffect(() => {
    if (isRegistered) {
      getCacheStats()
    }
  }, [isRegistered, getCacheStats])

  // Handle download complete
  useEffect(() => {
    if (mapCacheProgress && mapCacheProgress.total > 0 && mapCacheProgress.cached === mapCacheProgress.total) {
      setDownloading(false)
      toast.success(`Downloaded ${mapCacheProgress.cached} map tiles`)
      getCacheStats()
    }
  }, [mapCacheProgress, getCacheStats])

  const handleDownloadPiravom = () => {
    if (!isOnline) {
      toast.error('Cannot download while offline')
      return
    }
    setDownloading(true)
    cacheMapArea(PIRAVOM_BOUNDS, 17) // Zoom 10-17 for good detail
    toast.info('Downloading Piravom area map tiles...')
  }

  const handleDownloadErnakulam = () => {
    if (!isOnline) {
      toast.error('Cannot download while offline')
      return
    }
    setDownloading(true)
    cacheMapArea(ERNAKULAM_BOUNDS, 15) // Zoom 10-15 for larger area
    toast.info('Downloading Ernakulam district map tiles...')
  }

  const handleClearCache = async () => {
    setClearing(true)
    clearMapCache()
    await new Promise((r) => setTimeout(r, 500))
    await getCacheStats()
    setClearing(false)
    toast.success('Map cache cleared')
  }

  const totalCached = cacheStats ? Object.values(cacheStats).reduce((a, b) => a + b, 0) : 0
  const mapTilesCached = cacheStats?.['nirman-map-tiles-v1'] || 0

  // Estimate storage size (rough: ~15KB per tile)
  const estimatedSizeMB = (mapTilesCached * 15) / 1024

  if (!isSupported) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-amber-700">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">Offline mode not supported in this browser</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-zinc-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-zinc-500" />
          Offline Maps
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Online Status */}
        <div className="flex items-center justify-between px-3 py-2 bg-zinc-50 rounded-lg">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <>
                <Wifi className="w-4 h-4 text-emerald-500" />
                <span className="text-sm text-emerald-600 font-medium">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-amber-500" />
                <span className="text-sm text-amber-600 font-medium">Offline</span>
              </>
            )}
          </div>
          {!isRegistered && (
            <Badge variant="outline" className="text-xs text-zinc-500">
              Loading...
            </Badge>
          )}
        </div>

        {/* Cache Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="px-3 py-2 bg-zinc-50 rounded-lg">
            <p className="text-xs text-zinc-500">Map Tiles Cached</p>
            <p className="text-xl font-bold text-zinc-800">{mapTilesCached.toLocaleString()}</p>
          </div>
          <div className="px-3 py-2 bg-zinc-50 rounded-lg">
            <p className="text-xs text-zinc-500">Est. Storage</p>
            <p className="text-xl font-bold text-zinc-800">{estimatedSizeMB.toFixed(1)} MB</p>
          </div>
        </div>

        {/* Download Progress */}
        {downloading && mapCacheProgress && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Downloading...
              </span>
              <span className="text-zinc-700 font-medium">
                {mapCacheProgress.total > 0
                  ? `${mapCacheProgress.cached} / ${mapCacheProgress.total}`
                  : 'Calculating...'}
              </span>
            </div>
            <Progress
              value={
                mapCacheProgress.total > 0
                  ? (mapCacheProgress.cached / mapCacheProgress.total) * 100
                  : 0
              }
              className="h-2"
            />
          </div>
        )}

        {/* Ward Info */}
        {wardNumber && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg">
            <MapPin className="w-4 h-4 text-amber-600" />
            <div>
              <p className="text-xs text-amber-600">Assigned Ward</p>
              <p className="text-sm font-medium text-amber-800">
                Ward {wardNumber} · {district || 'Ernakulam'}
              </p>
            </div>
          </div>
        )}

        {/* Download Buttons */}
        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={handleDownloadPiravom}
            disabled={downloading || !isOnline}
          >
            <Download className="w-4 h-4" />
            Download Piravom Area (~50 MB)
            {mapTilesCached > 1000 && (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto" />
            )}
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={handleDownloadErnakulam}
            disabled={downloading || !isOnline}
          >
            <Download className="w-4 h-4" />
            Download Ernakulam District (~200 MB)
          </Button>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1"
            onClick={() => getCacheStats()}
            disabled={!isRegistered}
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={handleClearCache}
            disabled={clearing || mapTilesCached === 0}
          >
            {clearing ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Trash2 className="w-3 h-3" />
            )}
            Clear Cache
          </Button>
        </div>

        {/* Help Text */}
        <p className="text-[11px] text-zinc-400 leading-relaxed">
          Download map tiles for offline use in areas with poor connectivity. 
          Maps will load from local storage when you&apos;re offline.
        </p>
      </CardContent>
    </Card>
  )
}
