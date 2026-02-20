'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, ShoppingCart, MessageCircle, User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  badge?: number
}

export function BottomNav() {
  const pathname = usePathname()
  
  // Remove locale prefix from pathname for comparison
  const path = pathname.replace(/^\/(en|ml)/, '')

  const navItems: NavItem[] = [
    {
      label: 'Home',
      href: '/dashboard',
      icon: <Home className="w-5 h-5" />,
    },
    {
      label: 'Market',
      href: '/marketplace',
      icon: <ShoppingCart className="w-5 h-5" />,
    },
    {
      label: 'Chat',
      href: '/chat',
      icon: <MessageCircle className="w-5 h-5" />,
      badge: 0,
    },
    {
      label: 'Profile',
      href: '/profile',
      icon: <User className="w-5 h-5" />,
    },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border md:hidden">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const isActive = path === item.href || path.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center w-12 h-12 rounded-lg relative transition-colors',
                isActive
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {item.icon}
              {item.badge && item.badge > 0 && (
                <span className="absolute top-0 right-0 w-4 h-4 bg-destructive text-xs text-destructive-foreground rounded-full flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
