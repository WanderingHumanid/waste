'use client'

import { useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Locate, MapPin, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Coordinates {
  lat: number
  lng: number
}

interface LocationPickerProps {
  value?: Coordinates | null
  onChange: (coords: Coordinates) => void
  onAddressChange?: (address: string) => void
  className?: string
  height?: string
}

// Reverse geocoding using Nominatim
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'NirmanWasteApp/1.0',
        },
      }
    )
    
    if (!response.ok) throw new Error('Geocoding failed')
    
    const data = await response.json()
    return data.display_name || ''
  } catch (error) {
    console.error('Reverse geocoding error:', error)
    return ''
  }
}

// Dynamically import the map component with no SSR
const MapClient = dynamic(
  () => import('./map-client').then((mod) => mod.MapClient),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-muted flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin" />
          <p>Loading map...</p>
        </div>
      </div>
    )
  }
)

export function LocationPicker({
  value,
  onChange,
  onAddressChange,
  className,
  height = '400px',
}: LocationPickerProps) {
  // Default to Piravom, Kerala coordinates
  const defaultPosition: Coordinates = { lat: 9.9943, lng: 76.5373 }
  const [position, setPosition] = useState<Coordinates>(value || defaultPosition)
  const [isLocating, setIsLocating] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [isGeocoding, setIsGeocoding] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Update position when value prop changes
  useEffect(() => {
    if (value) {
      setPosition(value)
    }
  }, [value])

  // Reverse geocode when position changes
  const performReverseGeocode = useCallback(async (coords: Coordinates) => {
    if (!onAddressChange) return
    
    setIsGeocoding(true)
    const address = await reverseGeocode(coords.lat, coords.lng)
    setIsGeocoding(false)
    
    if (address) {
      onAddressChange(address)
    }
  }, [onAddressChange])

  const handleLocationSelect = useCallback((coords: Coordinates) => {
    setPosition(coords)
    onChange(coords)
    performReverseGeocode(coords)
  }, [onChange, performReverseGeocode])

  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser')
      return
    }

    setIsLocating(true)
    setLocationError(null)

    navigator.geolocation.getCurrentPosition(
      (geoPosition) => {
        const coords: Coordinates = {
          lat: geoPosition.coords.latitude,
          lng: geoPosition.coords.longitude,
        }
        setPosition(coords)
        onChange(coords)
        performReverseGeocode(coords)
        setIsLocating(false)
      },
      (error) => {
        setIsLocating(false)
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError('Location permission denied. Please enable location access.')
            break
          case error.POSITION_UNAVAILABLE:
            setLocationError('Location information unavailable.')
            break
          case error.TIMEOUT:
            setLocationError('Location request timed out.')
            break
          default:
            setLocationError('An unknown error occurred.')
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    )
  }, [onChange, performReverseGeocode])

  // SSR placeholder
  if (!mounted) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <CardContent className="p-0">
          <div 
            className="bg-muted flex items-center justify-center" 
            style={{ height }}
          >
            <div className="text-center text-muted-foreground">
              <MapPin className="w-8 h-8 mx-auto mb-2" />
              <p>Loading map...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="p-0">
        <div className="relative" style={{ height }}>
          <MapClient
            position={position}
            onLocationSelect={handleLocationSelect}
          />

          {/* Locate Me Button */}
          <Button
            variant="secondary"
            size="sm"
            className="absolute top-4 right-4 z-[1000] shadow-lg"
            onClick={handleLocateMe}
            disabled={isLocating}
          >
            {isLocating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Locate className="w-4 h-4 mr-2" />
            )}
            {isLocating ? 'Locating...' : 'Find My Location'}
          </Button>

          {/* Coordinates Display */}
          <div className="absolute bottom-4 left-4 right-4 z-[1000]">
            <Card className="bg-background/95 backdrop-blur">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium">Pin Location</span>
                  </div>
                  {isGeocoding && (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Latitude: </span>
                    <span className="font-mono">{position.lat.toFixed(6)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Longitude: </span>
                    <span className="font-mono">{position.lng.toFixed(6)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Error Display */}
          {locationError && (
            <div className="absolute top-16 right-4 z-[1000]">
              <Card className="bg-destructive/10 border-destructive">
                <CardContent className="p-3">
                  <p className="text-sm text-destructive">{locationError}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Instructions Overlay */}
          <div className="absolute top-4 left-4 z-[1000]">
            <Card className="bg-background/95 backdrop-blur max-w-[200px]">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">
                  <strong>Tap</strong> on map or <strong>drag</strong> the pin to set your exact location
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
