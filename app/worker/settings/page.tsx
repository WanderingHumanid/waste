'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  User,
  Phone,
  MapPin,
  Bell,
  Shield,
  Save,
  Loader2,
  Settings
} from 'lucide-react'

interface WorkerProfile {
  id: string
  full_name: string | null
  phone: string | null
  ward_number: number | null
  role: string
  assignments?: {
    ward_number: number | null
  }[]
}

export default function WorkerSettingsPage() {
  const supabase = createClient()
  const [profile, setProfile] = useState<WorkerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
  })
  const [notifications, setNotifications] = useState({
    newSignals: true,
    urgentPickups: true,
    dailySummary: false,
  })

  useEffect(() => {
    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, phone, role, assignments:worker_assignments(ward_number)')
        .eq('id', user.id)
        .single()

      if (data) {
        const assignments = (data as any)?.assignments
        const formattedProfile = {
          ...data,
          ward_number: Array.isArray(assignments) ? assignments[0]?.ward_number : (assignments?.ward_number || null)
        }
        setProfile(formattedProfile)
        setFormData({
          full_name: data.full_name || '',
          phone: data.phone || '',
        })
      }
      setLoading(false)
    }

    fetchProfile()
  }, [supabase])

  const handleSave = async () => {
    if (!profile) return
    setSaving(true)

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: formData.full_name,
        phone: formData.phone,
      })
      .eq('id', profile.id)

    if (error) {
      toast.error('Failed to save settings')
    } else {
      toast.success('Settings saved successfully')
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <Card className="bg-amber-900/50 border-amber-800">
          <CardHeader>
            <CardTitle className="text-amber-100 flex items-center gap-2">
              <Settings className="w-5 h-5 text-amber-400" />
              Worker Settings
            </CardTitle>
            <CardDescription className="text-amber-300/70">
              Manage your profile and preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="h-40 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-amber-100 flex items-center gap-2">
          <Settings className="w-6 h-6 text-amber-400" />
          Account Settings
        </h1>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-amber-600 hover:bg-amber-500 text-amber-950 font-bold"
        >
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Changes
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Profile Details */}
        <Card className="bg-amber-900/50 border-amber-800">
          <CardHeader>
            <CardTitle className="text-amber-100 flex items-center gap-2 text-lg">
              <User className="w-5 h-5 text-amber-400" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name" className="text-amber-200">Full Name</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="bg-amber-950/50 border-amber-800 text-amber-100 focus:ring-amber-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-amber-200">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 w-4 h-4 text-amber-500" />
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="bg-amber-950/50 border-amber-800 text-amber-100 pl-10 focus:ring-amber-500"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Work Assignment */}
        <Card className="bg-amber-900/50 border-amber-800">
          <CardHeader>
            <CardTitle className="text-amber-100 flex items-center gap-2 text-lg">
              <Shield className="w-5 h-5 text-amber-400" />
              Assignment Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-amber-950/50 rounded-lg border border-amber-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-400/10 rounded-full">
                  <MapPin className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-amber-100 font-medium">Assigned Ward</p>
                  <p className="text-xs text-amber-400">Primary working area</p>
                </div>
              </div>
              <Badge className="bg-amber-400 text-amber-950 font-bold px-3">
                {profile?.ward_number ? `Ward ${profile.ward_number}` : 'Unassigned'}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-amber-950/50 rounded-lg border border-amber-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-400/10 rounded-full">
                  <User className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-amber-100 font-medium">Worker Role</p>
                  <p className="text-xs text-amber-400">System permissions</p>
                </div>
              </div>
              <Badge variant="outline" className="border-emerald-500/50 text-emerald-400 capitalize">
                {profile?.role?.replace('_', ' ') || 'Worker'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="bg-amber-900/50 border-amber-800">
          <CardHeader>
            <CardTitle className="text-amber-100 flex items-center gap-2 text-lg">
              <Bell className="w-5 h-5 text-amber-400" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-amber-100">New Waste Signals</Label>
                <p className="text-xs text-amber-400">Get notified when someone is ready</p>
              </div>
              <Switch
                checked={notifications.newSignals}
                onCheckedChange={(val) => setNotifications({ ...notifications, newSignals: val })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-amber-100">Urgent Pickups</Label>
                <p className="text-xs text-amber-400">Priority alerts for backlog areas</p>
              </div>
              <Switch
                checked={notifications.urgentPickups}
                onCheckedChange={(val) => setNotifications({ ...notifications, urgentPickups: val })}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
