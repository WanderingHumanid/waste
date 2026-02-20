'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  Truck, 
  Map, 
  History, 
  Settings, 
  LogOut, 
  Menu,
  X,
  Wallet
} from 'lucide-react'

interface WorkerProfile {
  id: string
  full_name: string | null
  role: string
  ward_number: number | null
}

export default function WorkerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  
  const [worker, setWorker] = useState<WorkerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Skip layout for login page
  if (pathname === '/worker/login') {
    return <>{children}</>
  }

  useEffect(() => {
    async function checkWorker() {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/worker/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, role, ward_number')
        .eq('id', user.id)
        .single()

      if (!profile || (profile.role !== 'worker' && profile.role !== 'hks_worker' && profile.role !== 'admin')) {
        router.push('/worker/login')
        return
      }

      setWorker(profile)
      setLoading(false)
    }

    checkWorker()
  }, [router, supabase])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/worker/login')
  }

  const navItems = [
    { href: '/worker/dashboard', label: 'Pickup Radar', icon: Map },
    { href: '/worker/history', label: 'History', icon: History },
    { href: '/worker/earnings', label: 'Earnings', icon: Wallet },
    { href: '/worker/settings', label: 'Settings', icon: Settings },
  ]

  const getInitials = (name: string | null) => {
    if (!name) return 'W'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-amber-950 flex items-center justify-center">
        <div className="text-amber-400 text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-amber-950 text-amber-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-amber-900/95 backdrop-blur border-b border-amber-800">
        <div className="flex h-14 items-center justify-between px-4 max-w-7xl mx-auto">
          {/* Logo */}
          <Link href="/worker/dashboard" className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-400/20 rounded-lg">
              <Truck className="w-5 h-5 text-amber-400" />
            </div>
            <span className="font-bold text-lg text-amber-100">HKS Worker</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors',
                    isActive
                      ? 'bg-amber-400/20 text-amber-300'
                      : 'text-amber-200/70 hover:text-amber-100 hover:bg-amber-800/50'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              )
            })}
          </nav>

          {/* Right Side */}
          <div className="flex items-center gap-3">
            {/* Ward Badge */}
            {worker?.ward_number && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-amber-400/20 text-amber-300 rounded-full text-sm font-medium">
                Ward {worker.ward_number}
              </div>
            )}

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full hover:bg-amber-800/50">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-amber-400/20 text-amber-300">
                      {getInitials(worker?.full_name ?? null)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-amber-900 border-amber-800 text-amber-100">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{worker?.full_name || 'Worker'}</p>
                    <p className="text-xs text-amber-400">
                      Ward {worker?.ward_number || 'Unassigned'}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-amber-800" />
                <DropdownMenuItem onClick={handleSignOut} className="text-red-400 cursor-pointer focus:bg-amber-800 focus:text-red-300">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-amber-200 hover:bg-amber-800/50"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-amber-800 bg-amber-900">
            <nav className="flex flex-col p-2">
              {navItems.map((item) => {
                const isActive = pathname === item.href
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md transition-colors',
                      isActive
                        ? 'bg-amber-400/20 text-amber-300'
                        : 'text-amber-200/70 hover:text-amber-100 hover:bg-amber-800/50'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="w-full max-w-7xl mx-auto">
        {children}
      </main>
    </div>
  )
}
