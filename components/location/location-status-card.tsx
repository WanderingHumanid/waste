'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  MapPin, 
  Navigation, 
  Bell, 
  BellOff, 
  Home, 
  Edit2, 
  Check, 
  AlertTriangle,
  Loader2,
  Building2 
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface HouseholdLocation {
  id: string
  nickname: string
  manualAddress: string | null
  geocodedAddress: string | null
  wasteReady: boolean
  wardNumber: number | null
  lat: number
  lng: number
  locationUpdatedAt: string | null
}

interface LocationStatusCardProps {
  onSetupClick?: () => void
  onEditClick?: () => void
  className?: string
}

export function LocationStatusCard({
  onSetupClick,
  onEditClick,
  className,
}: LocationStatusCardProps) {
  const [household, setHousehold] = useState<HouseholdLocation | null>(null)
  const [loading, setLoading] = useState(true)
  const [togglingWasteReady, setTogglingWasteReady] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    fetchHousehold()
  }, [])

  const fetchHousehold = async () => {
    try {
      // Use the API endpoint which handles PostGIS parsing properly
      const response = await fetch('/api/households/establish', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })
      
      const result = await response.json()
      
      if (!result.success) {
        if (result.message?.includes('No household')) {
          // No household set up yet
          setLoading(false)
          return
        }
        console.error('Error fetching household:', result.error)
        setLoading(false)
        return
      }
      
      if (result.data) {
        const data = result.data
        setHousehold({
          id: data.household_id,
          nickname: data.nickname || 'My House',
          manualAddress: data.manual_address,
          geocodedAddress: data.geocoded_address,
          wasteReady: data.waste_ready || false,
          wardNumber: data.ward_number,
          lat: data.location?.lat || 0,
          lng: data.location?.lng || 0,
          locationUpdatedAt: data.location_updated_at,
        })
      }
    } catch (error) {
      console.error('Error loading household:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleWasteReady = async () => {
    if (!household) return

    setTogglingWasteReady(true)
    try {
      const newValue = !household.wasteReady
      
      // Use the API to toggle waste ready status
      const response = await fetch('/api/households/establish', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waste_ready: newValue }),
      })
      
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update status')
      }

      setHousehold({ ...household, wasteReady: newValue })
    } catch (error) {
      console.error('Error toggling waste ready:', error)
    } finally {
      setTogglingWasteReady(false)
    }
  }

  // SSR placeholder
  if (!mounted) {
    return (
      <Card className={cn('', className)}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Skeleton className="w-12 h-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card className={cn('', className)}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Skeleton className="w-12 h-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  // No household setup yet - show setup prompt
  if (!household) {
    return (
      <Card className={cn('border-dashed border-2', className)}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Set Up Your Location</CardTitle>
              <CardDescription>
                Anchor your home on the map for waste collection
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Drop a pin on your exact doorstep location to enable waste collection services. 
            This takes less than 30 seconds!
          </p>
        </CardContent>
        <CardFooter>
          <Button onClick={onSetupClick} className="w-full bg-green-600 hover:bg-green-700">
            <MapPin className="w-4 h-4 mr-2" />
            Anchor My House
          </Button>
        </CardFooter>
      </Card>
    )
  }

  // Household exists - show status card with waste ready toggle
  return (
    <Card className={cn('', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <Home className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                {household.nickname}
                <Badge variant="outline" className="text-xs">
                  <MapPin className="w-3 h-3 mr-1" />
                  Anchored
                </Badge>
              </CardTitle>
              <CardDescription>
                {household.wardNumber && `Ward ${household.wardNumber} • `}
                Location saved
              </CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onEditClick}>
            <Edit2 className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Address Display */}
        <div className="p-3 rounded-lg bg-muted/50">
          <div className="flex items-start gap-2">
            <Navigation className="w-4 h-4 mt-0.5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">
                {household.manualAddress || household.geocodedAddress || 'No address provided'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {household.lat.toFixed(6)}, {household.lng.toFixed(6)}
              </p>
            </div>
          </div>
        </div>

        {/* Mini Map Preview — OpenStreetMap iframe (no API key required) */}
        <div className="relative h-32 rounded-lg overflow-hidden bg-muted">
          <iframe
            title="Location preview"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${household.lng - 0.005},${household.lat - 0.005},${household.lng + 0.005},${household.lat + 0.005}&layer=mapnik&marker=${household.lat},${household.lng}`}
            className="w-full h-full border-0"
            loading="lazy"
            style={{ pointerEvents: 'none' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
        </div>

        {/* Waste Ready Toggle - The Digital Bell */}
        <div className={cn(
          'p-4 rounded-lg border-2 transition-colors',
          household.wasteReady 
            ? 'bg-green-50 dark:bg-green-950 border-green-500' 
            : 'bg-muted/50 border-transparent'
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center transition-colors',
                household.wasteReady 
                  ? 'bg-green-100 dark:bg-green-900' 
                  : 'bg-muted'
              )}>
                {household.wasteReady ? (
                  <Bell className="w-5 h-5 text-green-600 dark:text-green-400 animate-pulse" />
                ) : (
                  <BellOff className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className={cn(
                  'font-medium',
                  household.wasteReady && 'text-green-700 dark:text-green-300'
                )}>
                  {household.wasteReady ? 'Waste Ready!' : 'Waste Not Ready'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {household.wasteReady 
                    ? 'Collection worker can see your signal' 
                    : 'Toggle when waste is ready for pickup'
                  }
                </p>
              </div>
            </div>
            <Switch
              checked={household.wasteReady}
              onCheckedChange={toggleWasteReady}
              disabled={togglingWasteReady}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Compact version for sidebar/navbar
export function LocationStatusBadge({ className }: { className?: string }) {
  const [hasLocation, setHasLocation] = useState<boolean | null>(null)

  useEffect(() => {
    checkLocation()
  }, [])

  const checkLocation = async () => {
    try {
      const response = await fetch('/api/households/establish', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })
      
      const result = await response.json()
      
      if (result.success && result.data) {
        setHasLocation(result.data.location?.lat !== 0 || result.data.location?.lng !== 0)
      } else {
        setHasLocation(false)
      }
    } catch {
      setHasLocation(false)
    }
  }

  if (hasLocation === null) return null

  return (
    <Badge 
      variant={hasLocation ? 'default' : 'destructive'} 
      className={cn('gap-1', className)}
    >
      {hasLocation ? (
        <>
          <Check className="w-3 h-3" />
          Location Set
        </>
      ) : (
        <>
          <AlertTriangle className="w-3 h-3" />
          No Location
        </>
      )}
    </Badge>
  )
}
