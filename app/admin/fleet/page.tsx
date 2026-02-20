'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Truck, Clock, MapPin } from 'lucide-react'

export default function AdminFleetPage() {
  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold text-zinc-900">Fleet Dispatch</h2>
        <p className="text-sm text-zinc-500">Worker location tracking and route assignment</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: Truck, label: 'Active Workers', value: '—', color: 'text-sky-500' },
          { icon: Clock, label: 'Avg. Collection Time', value: '—', color: 'text-amber-500' },
          { icon: MapPin, label: 'Routes Active', value: '—', color: 'text-emerald-500' },
        ].map((stat) => (
          <Card key={stat.label} className="bg-white border-zinc-200 shadow-none">
            <CardContent className="p-5 flex items-center gap-3">
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
              <div>
                <p className="text-xs text-zinc-500">{stat.label}</p>
                <p className="text-xl font-bold text-zinc-900">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-white border-zinc-200 shadow-none">
        <CardContent className="py-16 text-center">
          <Truck className="w-8 h-8 text-zinc-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-zinc-500">Fleet Dispatch coming soon</p>
          <p className="text-xs text-zinc-400 mt-1">Real-time worker GPS tracking will appear here</p>
        </CardContent>
      </Card>
    </div>
  )
}
