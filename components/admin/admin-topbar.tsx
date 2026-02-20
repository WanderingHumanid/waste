'use client'

import { Bell, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { usePathname } from 'next/navigation'

const ROUTE_LABELS: Record<string, string> = {
  '/admin/dashboard': 'Overview',
  '/admin/users': 'User Management',
  '/admin/map': 'Geospatial Intelligence',
  '/admin/fleet': 'Fleet Dispatch',
  '/admin/finance': 'Financial Reports',
  '/admin/logs': 'Audit Logs',
  '/admin/settings': 'Settings',
}

export function AdminTopbar() {
  const pathname = usePathname()
  const label = Object.entries(ROUTE_LABELS).find(([key]) =>
    pathname.startsWith(key)
  )?.[1] ?? 'Admin'

  return (
    <header className="h-14 bg-white border-b border-zinc-200 flex items-center justify-between px-6 flex-shrink-0">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold text-zinc-900">{label}</h1>
        <Badge variant="outline" className="text-[10px] text-zinc-400 border-zinc-200">
          Suchitwa Mission Kerala
        </Badge>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden sm:block">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
          <Input
            placeholder="Search..."
            className="pl-8 h-8 w-48 text-xs bg-zinc-50 border-zinc-200 focus:w-64 transition-all"
          />
        </div>
        <button className="relative p-2 rounded-lg hover:bg-zinc-50 transition-colors">
          <Bell className="w-4 h-4 text-zinc-500" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-rose-500" />
        </button>
        <div className="w-7 h-7 rounded-full bg-zinc-900 flex items-center justify-center">
          <span className="text-[10px] font-bold text-white">A</span>
        </div>
      </div>
    </header>
  )
}
