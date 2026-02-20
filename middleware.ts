/**
 * Next.js Middleware
 * Handles authentication and routing
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Create response to potentially modify
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Create Supabase client with proper cookie handling
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          const value = request.cookies.get(name)?.value
          return value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            request.cookies.set({ name, value, ...options })
            response = NextResponse.next({
              request: { headers: request.headers },
            })
            response.cookies.set({ name, value, ...options })
          } catch (error) {
            console.error(`Error setting cookie ${name}:`, error)
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            request.cookies.set({ name, value: '', ...options })
            response = NextResponse.next({
              request: { headers: request.headers },
            })
            response.cookies.set({ name, value: '', ...options })
          } catch (error) {
            console.error(`Error removing cookie ${name}:`, error)
          }
        },
      },
    }
  )

  // Check authentication with error handling - clear bad tokens
  let session = null
  try {
    const { data: { session: authSession }, error } = await supabase.auth.getSession()
    
    if (error) {
      console.warn('Session retrieval error:', error.code)
      // Clear cookies if there's an auth error to prevent loops
      if (error.code === 'refresh_token_not_found' || error.code === 'invalid_token') {
        response.cookies.delete('sb-rtzawrqurynym...access-token')
        response.cookies.delete('sb-rtzawrqurynym...refresh-token')
        // Delete all supabase cookies
        response.cookies.getAll().forEach((cookie) => {
          if (cookie.name.includes('sb-')) {
            response.cookies.delete(cookie.name)
          }
        })
      }
    } else {
      session = authSession
    }
  } catch (error) {
    console.warn('Error checking session:', error instanceof Error ? error.message : 'Unknown error')
  }

  // Public routes that don't require authentication
  const publicRoutes = [
    '/login',
    '/register',
    '/admin/login',
    '/worker/login',
    '/auth/callback',
    '/forgot-password',
    '/terms',
    '/privacy',
  ]

  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

  // If user is not logged in and trying to access protected route
  if (!session && !isPublicRoute && pathname !== '/') {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // If user is logged in and trying to access login pages, redirect to dashboard
  if (session && (pathname === '/login' || pathname === '/')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Protect all /admin/* routes (except /admin/login)
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    if (!session) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()
    if (profile?.role !== 'admin') {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  // If logged in user visits admin login, check if they're admin
  if (session && pathname === '/admin/login') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (profile?.role === 'admin') {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url))
    }
  }

  // If logged in user visits worker login, check if they're worker
  if (session && pathname === '/worker/login') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (profile?.role === 'worker' || profile?.role === 'admin') {
      return NextResponse.redirect(new URL('/worker/dashboard', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    // Match all pathnames except for:
    // - api (API routes)
    // - _next/static (static files)
    // - _next/image (image optimization files)
    // - favicon.ico (favicon file)
    // - public folder
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg).*)',
  ],
}
