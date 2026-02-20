'use client'

import { useState, useCallback, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Zap, Leaf, BarChart3, AlertCircle, History, ShoppingBag, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

// Citizen Layer Components
import { VerificationBanner } from '@/components/citizen/verification-banner'
import { BlackspotReporter } from '@/components/citizen/blackspot-reporter'
import { FeeTracker, FeeTrackerCompact } from '@/components/citizen/fee-tracker'

// Location/Home Anchor Components
import { LocationStatusCard, HomeAnchorDialog } from '@/components/location'

// Waste type options
const WASTE_TYPES = [
  { id: 'wet', label: 'Wet Waste', description: 'Food scraps, vegetable peels' },
  { id: 'dry', label: 'Dry Waste', description: 'Paper, plastic, cardboard' },
  { id: 'recyclable', label: 'Recyclable', description: 'Bottles, cans, metal' },
  { id: 'hazardous', label: 'Hazardous', description: 'Batteries, chemicals' },
  { id: 'e-waste', label: 'E-Waste', description: 'Electronics, cables' },
] as const

interface DashboardData {
  name: string
  greenCredits: number
  nextCollection: string
  wasteReady: boolean
  itemsInMarketplace: number
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>({
    name: '',
    greenCredits: 0,
    nextCollection: '2026-02-22',
    wasteReady: false,
    itemsInMarketplace: 0,
  })
  const [loading, setLoading] = useState(false)
  const [canSignal, setCanSignal] = useState(false)
  const [showAnchorDialog, setShowAnchorDialog] = useState(false)
  const [locationKey, setLocationKey] = useState(0) // Force refresh location card
  const [selectedWasteTypes, setSelectedWasteTypes] = useState<string[]>(['wet', 'dry']) // Default types

  // Fetch user data on mount
  useEffect(() => {
    const fetchUserData = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // Get profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, green_credits')
          .eq('id', user.id)
          .single()

        // Get household waste_ready status
        const { data: household } = await supabase
          .from('households')
          .select('waste_ready')
          .eq('user_id', user.id)
          .single()

        // Get marketplace items count
        const { count } = await supabase
          .from('marketplace_items')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_available', true)

        setData(prev => ({
          ...prev,
          name: profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || '',
          greenCredits: profile?.green_credits || 0,
          wasteReady: household?.waste_ready || false,
          itemsInMarketplace: count || 0,
        }))
      }
    }

    fetchUserData()
  }, [])

  // Handle verification status changes
  const handleVerificationStatusChange = useCallback((verified: boolean) => {
    setCanSignal(verified)
  }, [])

  const toggleWasteReady = async () => {
    // Require at least one waste type if marking ready
    if (!data.wasteReady && selectedWasteTypes.length === 0) {
      toast.error('Please select at least one waste type')
      return
    }

    setLoading(true)
    try {
      // Call API to toggle waste ready status
      const response = await fetch('/api/households/establish', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          waste_ready: !data.wasteReady,
          waste_types: selectedWasteTypes,
        }),
      })

      const result = await response.json()

      if (result.success) {
        setData((prev) => ({
          ...prev,
          wasteReady: !prev.wasteReady,
        }))

        toast.success(data.wasteReady ? 'Status Updated' : 'Signal Sent!', {
          description: data.wasteReady
            ? 'Waste ready signal cancelled.'
            : `Your collection worker has been notified for ${selectedWasteTypes.join(', ')} waste.`,
        })
      } else {
        toast.error('Failed to update status', {
          description: result.error || 'Please try again.',
        })
      }
    } catch (error) {
      toast.error('Error', { description: 'Failed to update waste status.' })
    } finally {
      setLoading(false)
    }
  }

  const toggleWasteType = (typeId: string) => {
    setSelectedWasteTypes(prev =>
      prev.includes(typeId)
        ? prev.filter(t => t !== typeId)
        : [...prev, typeId]
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/10">
      <div className="space-y-6 p-4 md:p-8 max-w-6xl mx-auto">
        {/* Welcome Section */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {data.name ? `Welcome back, ${data.name}!` : 'Welcome back!'}
          </h1>
          <p className="text-muted-foreground mt-2">
            Your household waste management dashboard
          </p>
        </div>

        {/* Location Status Card - Home Anchor System */}
        <LocationStatusCard
          key={locationKey}
          onSetupClick={() => setShowAnchorDialog(true)}
          onEditClick={() => setShowAnchorDialog(true)}
          className="shadow-sm"
        />

        {/* Home Anchor Dialog */}
        <HomeAnchorDialog
          open={showAnchorDialog}
          onOpenChange={setShowAnchorDialog}
          onSuccess={() => {
            setLocationKey(prev => prev + 1) // Refresh location card
            setCanSignal(true) // Enable waste signaling after location is set
          }}
        />

        {/* Verification Banner - Optional for government-linked verification */}
        {/* Removed for standalone Home Anchor mode */}
        {/* <VerificationBanner 
          onStatusChange={handleVerificationStatusChange}
          className="shadow-sm"
        /> */}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Actions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Waste Ready Toggle - Featured Card */}
            <Card className={cn(
              'border-primary/20 relative overflow-hidden',
              'bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950 dark:to-green-950'
            )}>
              {/* Removed verification overlay - Home Anchor mode doesn't require HKS verification */}

              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <Zap className="w-6 h-6" />
                  Waste Ready Status
                </CardTitle>
                <CardDescription>
                  Select waste types and signal when ready for collection
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Waste Type Selection */}
                {!data.wasteReady && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-muted-foreground">
                      What type of waste do you have?
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {WASTE_TYPES.map((type) => (
                        <label
                          key={type.id}
                          className={cn(
                            'flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all',
                            selectedWasteTypes.includes(type.id)
                              ? 'border-primary bg-primary/10'
                              : 'border-border hover:border-primary/50'
                          )}
                        >
                          <Checkbox
                            checked={selectedWasteTypes.includes(type.id)}
                            onCheckedChange={() => toggleWasteType(type.id)}
                          />
                          <div>
                            <p className="text-sm font-medium">{type.label}</p>
                            <p className="text-xs text-muted-foreground">{type.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Status and Action */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-2">
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground mb-2">
                      Current Status:
                    </p>
                    <p className={cn(
                      'text-2xl font-bold',
                      data.wasteReady ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'
                    )}>
                      {data.wasteReady ? '✓ Ready for Collection' : '○ Not Ready'}
                    </p>
                    {data.wasteReady && selectedWasteTypes.length > 0 && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Types: {selectedWasteTypes.join(', ')}
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={toggleWasteReady}
                    disabled={loading || (!data.wasteReady && selectedWasteTypes.length === 0)}
                    size="lg"
                    variant={data.wasteReady ? 'outline' : 'default'}
                    className={cn(
                      'md:w-auto',
                      !data.wasteReady && 'bg-primary hover:bg-primary/90'
                    )}
                  >
                    {loading ? 'Updating...' : data.wasteReady ? 'Mark as Not Ready' : 'Mark as Ready'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Green Credits Card */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Leaf className="w-5 h-5 text-green-600" />
                    Green Credits
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-primary">{data.greenCredits}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Earned from proper waste disposal
                  </p>
                </CardContent>
              </Card>

              {/* Next Collection Card */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Next Collection</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {new Date(data.nextCollection).toLocaleDateString('en-IN', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Based on your collection history
                  </p>
                </CardContent>
              </Card>

              {/* Marketplace Listings Card */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ShoppingBag className="w-5 h-5 text-amber-600" />
                    Marketplace
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-primary">{data.itemsInMarketplace}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Active listings
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>
                  Common tasks and shortcuts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Button variant="outline" className="h-auto flex-col py-4" asChild>
                    <a href="/marketplace">
                      <BarChart3 className="w-5 h-5 mb-2" />
                      <span className="text-xs">List Item</span>
                    </a>
                  </Button>
                  <Button variant="outline" className="h-auto flex-col py-4" asChild>
                    <a href="/chat">
                      <Leaf className="w-5 h-5 mb-2" />
                      <span className="text-xs">Messages</span>
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Info Banner */}
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900 dark:text-blue-100">
                    SUCHITWA Mission Tip
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Proper waste disposal earns you green credits! Signal when waste is ready and trade recyclables on the marketplace.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Fee Tracker & Blackspot Reporter */}
          <div className="space-y-6">
            {/* Fee Tracker - Municipal Payments */}
            <FeeTracker />

            {/* Blackspot Reporter - Public Waste Issues */}
            <BlackspotReporter
              onSuccess={() => {
                toast.success('Thank you for reporting!', {
                  description: 'Municipal authorities will investigate the issue.',
                })
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
