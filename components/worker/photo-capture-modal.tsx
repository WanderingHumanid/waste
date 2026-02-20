'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Camera,
  MapPin,
  Upload,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Wifi,
  WifiOff,
  Image as ImageIcon,
  Compass,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// IndexedDB helper for offline storage
const DB_NAME = 'nirman_worker_db'
const DB_VERSION = 1
const STORE_NAME = 'pending_photos'

interface PendingPhoto {
  id: string
  householdId: string
  blob: Blob
  gps: {
    lat: number
    lng: number
    accuracy: number
    altitude: number | null
    heading: number | null
  }
  timestamp: number
  notes: string
  synced: boolean
}

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('synced', 'synced', { unique: false })
        store.createIndex('householdId', 'householdId', { unique: false })
      }
    }
  })
}

async function savePhotoOffline(photo: PendingPhoto): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.put(photo)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

async function getPendingPhotos(): Promise<PendingPhoto[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.getAll()
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      // Filter for unsynced photos
      const allPhotos = request.result as PendingPhoto[]
      resolve(allPhotos.filter(p => !p.synced))
    }
  })
}

async function markPhotoSynced(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const getReq = store.get(id)
    getReq.onsuccess = () => {
      if (getReq.result) {
        const updated = { ...getReq.result, synced: true }
        store.put(updated)
      }
      resolve()
    }
    getReq.onerror = () => reject(getReq.error)
  })
}

async function deletePhoto(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.delete(id)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

interface PhotoCaptureModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  householdId: string
  householdAddress?: string
  onPhotoUploaded?: (photoUrl: string) => void
}

export function PhotoCaptureModal({
  open,
  onOpenChange,
  householdId,
  householdAddress,
  onPhotoUploaded,
}: PhotoCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [cameraActive, setCameraActive] = useState(false)
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [gps, setGps] = useState<{
    lat: number
    lng: number
    accuracy: number
    altitude: number | null
    heading: number | null
  } | null>(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [uploading, setUploading] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)

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

  // Load pending count
  useEffect(() => {
    getPendingPhotos()
      .then((photos) => setPendingCount(photos.length))
      .catch(() => {})
  }, [])

  // Get GPS location
  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation not supported')
      return
    }

    setGpsLoading(true)
    setGpsError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGps({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          heading: position.coords.heading,
        })
        setGpsLoading(false)
      },
      (error) => {
        setGpsError(
          error.code === 1
            ? 'Location permission denied'
            : error.code === 2
            ? 'Location unavailable'
            : 'Location timeout'
        )
        setGpsLoading(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    )
  }, [])

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Prefer back camera
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraActive(true)

      // Also get GPS when starting camera
      getLocation()
    } catch (err) {
      console.error('Camera error:', err)
      toast.error('Could not access camera')
    }
  }, [getLocation])

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setCameraActive(false)
  }, [])

  // Capture photo
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0)

    canvas.toBlob(
      (blob) => {
        if (blob) {
          setPhoto(blob)
          setPhotoPreview(URL.createObjectURL(blob))
          stopCamera()
        }
      },
      'image/jpeg',
      0.85
    )
  }, [stopCamera])

  // Reset photo
  const resetPhoto = useCallback(() => {
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview)
    }
    setPhoto(null)
    setPhotoPreview(null)
  }, [photoPreview])

  // Upload or save offline
  const handleSubmit = useCallback(async () => {
    if (!photo || !gps) {
      toast.error('Photo and GPS location required')
      return
    }

    const photoData: PendingPhoto = {
      id: crypto.randomUUID(),
      householdId,
      blob: photo,
      gps,
      timestamp: Date.now(),
      notes,
      synced: false,
    }

    if (!isOnline) {
      // Save offline
      try {
        await savePhotoOffline(photoData)
        setPendingCount((c) => c + 1)
        toast.success('Photo saved offline - will sync when online')
        resetPhoto()
        onOpenChange(false)
      } catch (err) {
        toast.error('Failed to save photo offline')
      }
      return
    }

    // Upload online
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('photo', photo, `household_${householdId}_${Date.now()}.jpg`)
      formData.append('householdId', householdId)
      formData.append('lat', gps.lat.toString())
      formData.append('lng', gps.lng.toString())
      formData.append('accuracy', gps.accuracy.toString())
      formData.append('altitude', gps.altitude?.toString() || '')
      formData.append('heading', gps.heading?.toString() || '')
      formData.append('notes', notes)

      const res = await fetch('/api/worker/upload-photo', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (data.success) {
        toast.success('Photo uploaded successfully')
        onPhotoUploaded?.(data.photoUrl)
        resetPhoto()
        onOpenChange(false)
      } else {
        throw new Error(data.error || 'Upload failed')
      }
    } catch (err) {
      // Save offline as fallback
      try {
        await savePhotoOffline(photoData)
        setPendingCount((c) => c + 1)
        toast.warning('Upload failed - saved offline for later')
        resetPhoto()
        onOpenChange(false)
      } catch {
        toast.error('Failed to save photo')
      }
    } finally {
      setUploading(false)
    }
  }, [photo, gps, householdId, notes, isOnline, resetPhoto, onOpenChange, onPhotoUploaded])

  // Sync pending photos when online
  const syncPendingPhotos = useCallback(async () => {
    if (!isOnline) return

    const pending = await getPendingPhotos()
    if (pending.length === 0) return

    toast.info(`Syncing ${pending.length} pending photos...`)

    for (const p of pending) {
      try {
        const formData = new FormData()
        formData.append('photo', p.blob, `household_${p.householdId}_${p.timestamp}.jpg`)
        formData.append('householdId', p.householdId)
        formData.append('lat', p.gps.lat.toString())
        formData.append('lng', p.gps.lng.toString())
        formData.append('accuracy', p.gps.accuracy.toString())
        formData.append('altitude', p.gps.altitude?.toString() || '')
        formData.append('heading', p.gps.heading?.toString() || '')
        formData.append('notes', p.notes)

        const res = await fetch('/api/worker/upload-photo', {
          method: 'POST',
          body: formData,
        })

        if (res.ok) {
          await deletePhoto(p.id)
          setPendingCount((c) => Math.max(0, c - 1))
        }
      } catch {
        // Keep in queue for next sync
      }
    }

    toast.success('Sync complete')
  }, [isOnline])

  // Cleanup on close
  useEffect(() => {
    if (!open) {
      stopCamera()
      resetPhoto()
      setNotes('')
    }
  }, [open, stopCamera, resetPhoto])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-amber-500" />
            Capture Household Photo
          </DialogTitle>
        </DialogHeader>

        {/* Online/Offline Status */}
        <div className="flex items-center justify-between px-3 py-2 bg-zinc-50 rounded-lg">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <>
                <Wifi className="w-4 h-4 text-emerald-500" />
                <span className="text-xs text-emerald-600">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-amber-500" />
                <span className="text-xs text-amber-600">Offline - photos will queue</span>
              </>
            )}
          </div>
          {pendingCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={syncPendingPhotos}
              disabled={!isOnline}
            >
              <Upload className="w-3 h-3" />
              Sync {pendingCount}
            </Button>
          )}
        </div>

        {/* Household Info */}
        {householdAddress && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardContent className="p-3">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-amber-600 font-medium">Household</p>
                  <p className="text-sm text-zinc-800">{householdAddress}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Camera / Photo Preview */}
        <div className="relative aspect-video bg-zinc-900 rounded-lg overflow-hidden">
          {cameraActive && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          )}

          {photoPreview && (
            <img
              src={photoPreview}
              alt="Captured"
              className="w-full h-full object-cover"
            />
          )}

          {!cameraActive && !photoPreview && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-400">
              <ImageIcon className="w-12 h-12 mb-2" />
              <p className="text-sm">Camera preview</p>
            </div>
          )}

          {/* Camera Controls Overlay */}
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-3">
            {!cameraActive && !photoPreview && (
              <Button
                onClick={startCamera}
                className="bg-amber-500 hover:bg-amber-600 text-white gap-2"
              >
                <Camera className="w-4 h-4" />
                Start Camera
              </Button>
            )}

            {cameraActive && (
              <Button
                onClick={capturePhoto}
                size="lg"
                className="w-14 h-14 rounded-full bg-white hover:bg-zinc-100 border-4 border-amber-500"
              >
                <div className="w-6 h-6 rounded-full bg-red-500" />
              </Button>
            )}

            {photoPreview && (
              <>
                <Button
                  variant="outline"
                  onClick={resetPhoto}
                  className="bg-white/90 hover:bg-white gap-1"
                >
                  <RotateCcw className="w-4 h-4" />
                  Retake
                </Button>
              </>
            )}
          </div>
        </div>

        <canvas ref={canvasRef} className="hidden" />

        {/* GPS Status */}
        <Card className={cn(
          'border',
          gps ? 'border-emerald-200 bg-emerald-50/50' :
          gpsError ? 'border-red-200 bg-red-50/50' :
          'border-zinc-200'
        )}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className={cn(
                  'w-4 h-4',
                  gps ? 'text-emerald-600' : gpsError ? 'text-red-500' : 'text-zinc-400'
                )} />
                {gpsLoading ? (
                  <span className="text-xs text-zinc-500 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Getting location...
                  </span>
                ) : gps ? (
                  <div>
                    <p className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      GPS Locked
                    </p>
                    <p className="text-[10px] text-zinc-500 font-mono">
                      {gps.lat.toFixed(6)}, {gps.lng.toFixed(6)} (±{gps.accuracy.toFixed(0)}m)
                    </p>
                  </div>
                ) : gpsError ? (
                  <span className="text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {gpsError}
                  </span>
                ) : (
                  <span className="text-xs text-zinc-500">Location not captured</span>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={getLocation}
                disabled={gpsLoading}
              >
                {gpsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Refresh'}
              </Button>
            </div>
            {gps?.heading != null && (
              <div className="flex items-center gap-1 mt-2 text-[10px] text-zinc-500">
                <Compass className="w-3 h-3" />
                Heading: {gps.heading.toFixed(0)}°
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        <div className="space-y-1.5">
          <Label className="text-xs text-zinc-600">Notes (optional)</Label>
          <Input
            placeholder="e.g., House color, landmarks, access notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="text-sm"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 bg-amber-500 hover:bg-amber-600 text-white gap-2"
            onClick={handleSubmit}
            disabled={!photo || !gps || uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading...
              </>
            ) : !isOnline ? (
              <>
                <Upload className="w-4 h-4" />
                Save Offline
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Upload Photo
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
