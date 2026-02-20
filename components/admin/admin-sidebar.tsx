'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  Map,
  Truck,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Leaf,
  LogOut,
  Settings,
  Bell,
  FileText,
  Shield,
  Wallet,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface NavItem {
  label: string
  href?: string
  icon: React.ElementType
  children?: { label: string; href: string }[]
}

const NAV: NavItem[] = [
  {
    label: 'Overview',
    href: '/admin/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'User Management',
    icon: Users,
    children: [
      { label: 'All Users', href: '/admin/users' },
      { label: 'Role Escalation', href: '/admin/users?filter=citizens' },
      { label: 'Worker Allocation', href: '/admin/users?filter=workers' },
    ],
  },
  {
    label: 'Intelligence',
    icon: Map,
    children: [
      { label: 'Geospatial Map', href: '/admin/map' },
      { label: 'Hotspot Heatmap', href: '/admin/map?layer=hotspots' },
      { label: 'ML Predictions', href: '/admin/map?layer=predictions' },
    ],
  },
  {
    label: 'Fleet Dispatch',
    icon: Truck,
    children: [
      { label: 'Active Workers', href: '/admin/fleet' },
      { label: 'Route Optimization', href: '/admin/fleet?view=routes' },
    ],
  },
  {
    label: 'Financial Reports',
    icon: Wallet,
    children: [
      { label: 'Revenue Overview', href: '/admin/finance' },
      { label: 'Fee Collection', href: '/admin/finance?tab=fees' },
      { label: 'Green Credits', href: '/admin/finance?tab=credits' },
    ],
  },
  {
    label: 'Analytics',
    icon: BarChart3,
    children: [
      { label: 'Performance KPIs', href: '/admin/performance' },
      { label: 'ML Predictions', href: '/admin/predictions' },
    ],
  },
  {
    label: 'Audit Logs',
    href: '/admin/logs',
    icon: FileText,
  },
]

interface AdminSidebarProps {
  className?: string
}

export function AdminSidebar({ className }: AdminSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [expanded, setExpanded] = useState<string[]>(['User Management', 'Intelligence'])

  const toggle = (label: string) => {
    setExpanded((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    )
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '?')

  return (
    <aside
      className={cn(
        'flex flex-col w-64 min-h-screen bg-zinc-950 border-r border-zinc-800',
        className
      )}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-zinc-800">
        <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0">
          <Leaf className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white tracking-tight">Nirman Admin</p>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Command Center</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        {NAV.map((item) => {
          const Icon = item.icon
          const isExpanded = expanded.includes(item.label)

          if (!item.children) {
            return (
              <Link
                key={item.label}
                href={item.href!}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors',
                  isActive(item.href!)
                    ? 'bg-emerald-500/10 text-white border-l-2 border-emerald-500 rounded-l-none'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
              </Link>
            )
          }

          const anyChildActive = item.children.some((c) => pathname === c.href)

          return (
            <div key={item.label} className="mb-0.5">
              <button
                onClick={() => toggle(item.label)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                  anyChildActive
                    ? 'text-white'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-600" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
                )}
              </button>

              {isExpanded && (
                <div className="ml-7 mt-0.5 flex flex-col gap-0.5 border-l border-zinc-800 pl-3">
                  {item.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={cn(
                        'block text-sm px-2 py-1.5 rounded-md transition-colors',
                        pathname === child.href
                          ? 'text-emerald-400 font-medium'
                          : 'text-zinc-500 hover:text-zinc-200'
                      )}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-zinc-800 p-3 space-y-1">
        <Link
          href="/admin/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-500 hover:text-white hover:bg-zinc-800/60 transition-colors"
        >
          <Settings className="w-4 h-4" />
          Settings
        </Link>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-500 hover:text-rose-400 hover:bg-rose-500/5 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
        <div className="px-3 pt-2 flex items-center gap-2">
          <Shield className="w-3 h-3 text-emerald-600" />
          <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Secured Portal</span>
        </div>
      </div>
    </aside>
  )
}
