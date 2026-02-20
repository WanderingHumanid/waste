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
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
    Camera,
    MapPin,
    Upload,
    Loader2,
    CheckCircle2,
    AlertCircle,
    RotateCcw,
    XCircle,
    Compass,
    Image as ImageIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// Decline reason options
const DECLINE_REASONS = [
    { id: 'no_access', label: 'No Access', description: 'Gate locked or blocked' },
    { id: 'resident_absent', label: 'Resident Absent', description: 'No one available' },
    { id: 'waste_not_ready', label: 'Waste Not Ready', description: 'Waste not segregated or prepared' },
    { id: 'hazardous_waste', label: 'Hazardous Waste', description: 'Unsafe materials found' },
    { id: 'vehicle_full', label: 'Vehicle Full', description: 'Truck at capacity' },
    { id: 'wrong_location', label: 'Wrong Location', description: 'Address incorrect' },
    { id: 'other', label: 'Other', description: 'Specify reason below' },
] as const

interface PickupConfirmationModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    zoneName: string
    zoneId: string
    isHousehold: boolean
    householdId?: string
    onConfirmed: (photoUrl?: string) => void
    onDeclined: (reason: string, details: string) => void
}

export function PickupConfirmationModal({
    open,
    onOpenChange,
    zoneName,
    zoneId,
    isHousehold,
    householdId,
    onConfirmed,
    onDeclined,
}: PickupConfirmationModalProps) {
    // Modal state
    const [mode, setMode] = useState<'choose' | 'photo' | 'decline'>('choose')

    // Photo state
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
    } | null>(null)
    const [gpsLoading, setGpsLoading] = useState(false)
    const [uploading, setUploading] = useState(false)

    // Decline state
    const [selectedReason, setSelectedReason] = useState<string>('')
    const [reasonDetails, setReasonDetails] = useState('')
    const [declining, setDeclining] = useState(false)

    // Get GPS location
    const getLocation = useCallback(() => {
        if (!navigator.geolocation) return

        setGpsLoading(true)
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setGps({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                })
                setGpsLoading(false)
            },
            () => setGpsLoading(false),
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        )
    }, [])

    // Start camera
    const startCamera = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
                audio: false,
            })
            streamRef.current = stream
            if (videoRef.current) {
                videoRef.current.srcObject = stream
                await videoRef.current.play()
            }
            setCameraActive(true)
            getLocation()
        } catch {
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
        if (photoPreview) URL.revokeObjectURL(photoPreview)
        setPhoto(null)
        setPhotoPreview(null)
    }, [photoPreview])

    // Upload photo and confirm
    const handleConfirmWithPhoto = useCallback(async () => {
        if (!photo || !gps) {
            toast.error('Photo and GPS location are required')
            return
        }

        setUploading(true)
        try {
            // Upload photo
            const formData = new FormData()
            formData.append('photo', photo, `pickup_${zoneId}_${Date.now()}.jpg`)
            formData.append('householdId', householdId || zoneId)
            formData.append('lat', gps.lat.toString())
            formData.append('lng', gps.lng.toString())
            formData.append('accuracy', gps.accuracy.toString())
            formData.append('notes', `Pickup confirmed for ${zoneName}`)

            const res = await fetch('/api/worker/upload-photo', {
                method: 'POST',
                body: formData,
            })

            const data = await res.json()

            if (data.success) {
                toast.success('✅ Pickup confirmed with photo proof!')
                onConfirmed(data.photoUrl)
                handleClose()
            } else {
                // Even if upload fails, allow confirmation
                toast.warning('Photo upload failed, but confirming pickup')
                onConfirmed()
                handleClose()
            }
        } catch {
            toast.warning('Photo upload failed, but confirming pickup')
            onConfirmed()
            handleClose()
        } finally {
            setUploading(false)
        }
    }, [photo, gps, zoneId, householdId, zoneName, onConfirmed])

    // Handle decline
    const handleDecline = useCallback(async () => {
        if (!selectedReason) {
            toast.error('Please select a reason')
            return
        }

        setDeclining(true)
        try {
            onDeclined(selectedReason, reasonDetails)
            toast.info('Pickup declined. Reason recorded.')
            handleClose()
        } finally {
            setDeclining(false)
        }
    }, [selectedReason, reasonDetails, onDeclined])

    // Reset and close
    const handleClose = useCallback(() => {
        stopCamera()
        resetPhoto()
        setMode('choose')
        setSelectedReason('')
        setReasonDetails('')
        setGps(null)
        onOpenChange(false)
    }, [stopCamera, resetPhoto, onOpenChange])

    // Cleanup on close
    useEffect(() => {
        if (!open) {
            stopCamera()
        }
    }, [open, stopCamera])

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base">
                        {mode === 'choose' && (
                            <>
                                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                Confirm Pickup — {zoneName}
                            </>
                        )}
                        {mode === 'photo' && (
                            <>
                                <Camera className="w-5 h-5 text-amber-500" />
                                Take Proof Photo
                            </>
                        )}
                        {mode === 'decline' && (
                            <>
                                <XCircle className="w-5 h-5 text-red-500" />
                                Decline Pickup — Reason
                            </>
                        )}
                    </DialogTitle>
                </DialogHeader>

                {/* ===== CHOOSE MODE ===== */}
                {mode === 'choose' && (
                    <div className="space-y-4">
                        <p className="text-sm text-zinc-500">
                            {isHousehold
                                ? 'This household marked waste as ready. Confirm you picked it up, or decline with a reason.'
                                : 'Confirm this zone\'s waste has been collected, or decline if you couldn\'t collect.'}
                        </p>

                        <div className="grid grid-cols-1 gap-3">
                            {/* Confirm Option */}
                            <button
                                onClick={() => {
                                    setMode('photo')
                                    setTimeout(() => startCamera(), 300)
                                }}
                                className="flex items-start gap-4 p-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-300 transition-all text-left"
                            >
                                <div className="p-2.5 rounded-full bg-emerald-500 text-white shrink-0">
                                    <Camera className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-semibold text-emerald-800">✅ Confirm Pickup</p>
                                    <p className="text-sm text-emerald-600 mt-0.5">
                                        Take a geo-tagged photo as proof of collection
                                    </p>
                                </div>
                            </button>

                            {/* Decline Option */}
                            <button
                                onClick={() => setMode('decline')}
                                className="flex items-start gap-4 p-4 rounded-xl border-2 border-red-200 bg-red-50 hover:bg-red-100 hover:border-red-300 transition-all text-left"
                            >
                                <div className="p-2.5 rounded-full bg-red-500 text-white shrink-0">
                                    <XCircle className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-semibold text-red-800">❌ Decline Pickup</p>
                                    <p className="text-sm text-red-600 mt-0.5">
                                        Report why waste couldn't be collected
                                    </p>
                                </div>
                            </button>
                        </div>
                    </div>
                )}

                {/* ===== PHOTO MODE ===== */}
                {mode === 'photo' && (
                    <div className="space-y-4">
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
                                    <p className="text-sm">Starting camera...</p>
                                </div>
                            )}

                            {/* Camera Controls Overlay */}
                            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-3">
                                {cameraActive && (
                                    <Button
                                        onClick={capturePhoto}
                                        size="lg"
                                        className="w-14 h-14 rounded-full bg-white hover:bg-zinc-100 border-4 border-emerald-500"
                                    >
                                        <div className="w-6 h-6 rounded-full bg-red-500" />
                                    </Button>
                                )}

                                {photoPreview && (
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            resetPhoto()
                                            startCamera()
                                        }}
                                        className="bg-white/90 hover:bg-white gap-1"
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                        Retake
                                    </Button>
                                )}
                            </div>
                        </div>

                        <canvas ref={canvasRef} className="hidden" />

                        {/* GPS Status */}
                        <Card className={cn(
                            'border',
                            gps ? 'border-emerald-200 bg-emerald-50/50' : 'border-zinc-200'
                        )}>
                            <CardContent className="p-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <MapPin className={cn(
                                            'w-4 h-4',
                                            gps ? 'text-emerald-600' : 'text-zinc-400'
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
                                                    GPS Tagged
                                                </p>
                                                <p className="text-[10px] text-zinc-500 font-mono">
                                                    {gps.lat.toFixed(6)}, {gps.lng.toFixed(6)} (±{gps.accuracy.toFixed(0)}m)
                                                </p>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-zinc-500">Acquiring GPS...</span>
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
                            </CardContent>
                        </Card>

                        {/* Actions */}
                        <div className="flex gap-2 pt-1">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => {
                                    stopCamera()
                                    resetPhoto()
                                    setMode('choose')
                                }}
                            >
                                Back
                            </Button>
                            <Button
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                                onClick={handleConfirmWithPhoto}
                                disabled={!photo || !gps || uploading}
                            >
                                {uploading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Uploading...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-4 h-4" />
                                        Confirm Pickup
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                )}

                {/* ===== DECLINE MODE ===== */}
                {mode === 'decline' && (
                    <div className="space-y-4">
                        <p className="text-sm text-zinc-500">
                            Select the reason for not collecting waste:
                        </p>

                        {/* Reason Grid */}
                        <div className="grid grid-cols-2 gap-2">
                            {DECLINE_REASONS.map((reason) => (
                                <button
                                    key={reason.id}
                                    onClick={() => setSelectedReason(reason.id)}
                                    className={cn(
                                        'p-3 rounded-lg border-2 text-left transition-all',
                                        selectedReason === reason.id
                                            ? 'border-red-400 bg-red-50'
                                            : 'border-zinc-200 hover:border-red-200 hover:bg-red-50/50'
                                    )}
                                >
                                    <p className="text-xs font-semibold text-zinc-800">{reason.label}</p>
                                    <p className="text-[10px] text-zinc-500 mt-0.5">{reason.description}</p>
                                </button>
                            ))}
                        </div>

                        {/* Details */}
                        <div className="space-y-1.5">
                            <Label className="text-xs text-zinc-600">Additional Details (optional)</Label>
                            <Textarea
                                placeholder="Describe the situation..."
                                value={reasonDetails}
                                onChange={(e) => setReasonDetails(e.target.value)}
                                className="text-sm resize-none h-20"
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-1">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => {
                                    setSelectedReason('')
                                    setReasonDetails('')
                                    setMode('choose')
                                }}
                            >
                                Back
                            </Button>
                            <Button
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white gap-2"
                                onClick={handleDecline}
                                disabled={!selectedReason || declining}
                            >
                                {declining ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <XCircle className="w-4 h-4" />
                                )}
                                Submit Decline
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
