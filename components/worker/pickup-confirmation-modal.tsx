'use client'

import { useState, useCallback, useEffect } from 'react'
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
    Loader2,
    CheckCircle2,
    XCircle,
    ImageIcon,
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

// Demo placeholder photo (green checkmark image)
const DEMO_PHOTO_URL = 'https://placehold.co/800x600/22c55e/ffffff?text=✅+Waste+Collected'

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
    const [mode, setMode] = useState<'choose' | 'confirm' | 'decline'>('choose')

    // GPS state
    const [gps, setGps] = useState<{
        lat: number
        lng: number
        accuracy: number
    } | null>(null)
    const [gpsLoading, setGpsLoading] = useState(false)
    const [confirming, setConfirming] = useState(false)

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
            () => {
                // Fallback GPS for demo
                setGps({ lat: 9.8733, lng: 76.4974, accuracy: 15 })
                setGpsLoading(false)
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        )
    }, [])

    // Auto-get GPS when entering confirm mode
    useEffect(() => {
        if (mode === 'confirm' && !gps) {
            getLocation()
        }
    }, [mode, gps, getLocation])

    // Confirm pickup with demo photo
    const handleConfirmPickup = useCallback(async () => {
        if (!gps) {
            toast.error('GPS location is required')
            return
        }

        setConfirming(true)
        try {
            // Simulate a brief upload delay for demo realism
            await new Promise(resolve => setTimeout(resolve, 800))

            toast.success('✅ Pickup confirmed with geo-tagged proof!')
            onConfirmed(DEMO_PHOTO_URL)
            handleClose()
        } catch {
            toast.warning('Error, but confirming pickup')
            onConfirmed()
            handleClose()
        } finally {
            setConfirming(false)
        }
    }, [gps, onConfirmed])

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
        setMode('choose')
        setSelectedReason('')
        setReasonDetails('')
        setGps(null)
        onOpenChange(false)
    }, [onOpenChange])

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
                        {mode === 'confirm' && (
                            <>
                                <Camera className="w-5 h-5 text-emerald-500" />
                                Verify & Confirm Collection
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
                                onClick={() => setMode('confirm')}
                                className="flex items-start gap-4 p-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-300 transition-all text-left"
                            >
                                <div className="p-2.5 rounded-full bg-emerald-500 text-white shrink-0">
                                    <Camera className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-semibold text-emerald-800">✅ Confirm Pickup</p>
                                    <p className="text-sm text-emerald-600 mt-0.5">
                                        Verify with geo-tagged proof of collection
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

                {/* ===== CONFIRM MODE (Demo-friendly) ===== */}
                {mode === 'confirm' && (
                    <div className="space-y-4">
                        {/* Demo Photo Preview */}
                        <div className="relative aspect-video bg-emerald-900 rounded-lg overflow-hidden flex items-center justify-center">
                            <div className="text-center">
                                <div className="text-6xl mb-3">📸</div>
                                <p className="text-emerald-100 text-sm font-medium">Geo-Tagged Collection Proof</p>
                                <p className="text-emerald-300/70 text-xs mt-1">Photo will be attached automatically</p>
                            </div>
                            {/* GPS overlay badge */}
                            {gps && (
                                <div className="absolute bottom-2 left-2 bg-black/60 text-emerald-400 text-[10px] font-mono px-2 py-1 rounded">
                                    📍 {gps.lat.toFixed(6)}, {gps.lng.toFixed(6)}
                                </div>
                            )}
                            <div className="absolute top-2 right-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded">
                                LIVE
                            </div>
                        </div>

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
                                                    GPS Location Locked
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
                                    setGps(null)
                                    setMode('choose')
                                }}
                            >
                                Back
                            </Button>
                            <Button
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                                onClick={handleConfirmPickup}
                                disabled={!gps || confirming}
                            >
                                {confirming ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Confirming...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-4 h-4" />
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
