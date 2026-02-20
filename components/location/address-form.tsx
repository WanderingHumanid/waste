'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Home, MapPin, Building2, Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

// Piravom wards (1-19)
const PIRAVOM_WARDS = Array.from({ length: 19 }, (_, i) => i + 1)

export interface AddressFormData {
  nickname: string
  manualAddress: string
  geocodedAddress: string
  wardNumber: number | null
}

interface AddressFormProps {
  geocodedAddress?: string
  value?: Partial<AddressFormData>
  onChange: (data: AddressFormData) => void
  className?: string
}

export function AddressForm({
  geocodedAddress = '',
  value,
  onChange,
  className,
}: AddressFormProps) {
  const [formData, setFormData] = useState<AddressFormData>({
    nickname: value?.nickname || 'My House',
    manualAddress: value?.manualAddress || '',
    geocodedAddress: value?.geocodedAddress || geocodedAddress,
    wardNumber: value?.wardNumber || null,
  })

  // Update geocoded address when prop changes
  useEffect(() => {
    if (geocodedAddress && geocodedAddress !== formData.geocodedAddress) {
      const updated = { ...formData, geocodedAddress }
      setFormData(updated)
      onChange(updated)
    }
  }, [geocodedAddress])

  const handleChange = (field: keyof AddressFormData, value: string | number | null) => {
    const updated = { ...formData, [field]: value }
    setFormData(updated)
    onChange(updated)
  }

  // Quick nickname presets
  const nicknamePresets = ['My House', 'Home', 'Office', 'Shop', 'Apartment']

  return (
    <Card className={cn('', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Home className="w-5 h-5 text-green-600" />
          Location Details
        </CardTitle>
        <CardDescription>
          Add a friendly name and address for your waste collection point
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Nickname */}
        <div className="space-y-2">
          <Label htmlFor="nickname">Location Name</Label>
          <Input
            id="nickname"
            placeholder="e.g., My House, Office"
            value={formData.nickname}
            onChange={(e) => handleChange('nickname', e.target.value)}
          />
          <div className="flex flex-wrap gap-2 mt-2">
            {nicknamePresets.map((preset) => (
              <Badge
                key={preset}
                variant={formData.nickname === preset ? 'default' : 'outline'}
                className="cursor-pointer hover:bg-primary/10"
                onClick={() => handleChange('nickname', preset)}
              >
                {preset}
              </Badge>
            ))}
          </div>
        </div>

        {/* Geocoded Address (from Nominatim) */}
        {formData.geocodedAddress && (
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              Detected Address
            </Label>
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                {formData.geocodedAddress}
              </p>
            </div>
          </div>
        )}

        {/* Manual Address */}
        <div className="space-y-2">
          <Label htmlFor="manualAddress">
            Manual Address <span className="text-muted-foreground">(for waste workers)</span>
          </Label>
          <Textarea
            id="manualAddress"
            placeholder="Enter your complete address with landmarks (e.g., Near City Mall, Opposite SBI Bank)"
            value={formData.manualAddress}
            onChange={(e) => handleChange('manualAddress', e.target.value)}
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            This address will be shown to waste collection workers to help them find your location
          </p>
        </div>

        {/* Ward Selection */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-orange-600" />
            Ward Number
          </Label>
          <Select
            value={formData.wardNumber?.toString() || ''}
            onValueChange={(val) => handleChange('wardNumber', val ? parseInt(val) : null)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select your ward (1-19)" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {PIRAVOM_WARDS.map((ward) => (
                <SelectItem key={ward} value={ward.toString()}>
                  Ward {ward}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Piravom has 19 wards. Select your ward for zone-based waste collection routing.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

// Ward info tooltip component
export function WardInfoCard({ wardNumber }: { wardNumber: number | null }) {
  if (!wardNumber) return null

  return (
    <Card className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950 dark:to-amber-950 border-orange-200 dark:border-orange-800">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <p className="font-semibold text-orange-900 dark:text-orange-100">
              Ward {wardNumber}
            </p>
            <p className="text-sm text-orange-700 dark:text-orange-300">
              Piravom Grama Panchayat
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
