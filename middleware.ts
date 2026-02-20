/**
 * Next.js Middleware
 * Handles authentication and routing
 */

import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Create response to potentially modify
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Create Supabase client using getAll/setAll for proper chunked cookie handling
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

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

  // Check authentication - use getUser() for server-side verification
  const { data: { user }, error } = await supabase.auth.getUser()

  // If user is not logged in and trying to access protected route
  if ((!user || error) && !isPublicRoute) {
    const redirectUrl = new URL('/login', request.url)
    if (pathname !== '/') {
      redirectUrl.searchParams.set('next', pathname)
    }
    return NextResponse.redirect(redirectUrl)
  }

  // No user - allow access to public routes
  if (!user) {
    return response
  }

  // Fetch profile ONCE for all subsequent checks
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role || 'citizen'

  // If user is logged in and trying to access login pages or root, redirect based on role
  if (pathname === '/login' || pathname === '/register' || pathname === '/') {
    if (role === 'admin') {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url))
    } else if (role === 'worker') {
      return NextResponse.redirect(new URL('/worker/dashboard', request.url))
    }
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Protect /admin/* routes (except /admin/login)
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    if (role !== 'admin') {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  // If logged in user visits admin login and is admin, redirect to dashboard
  if (pathname === '/admin/login' && role === 'admin') {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url))
  }

  // If logged in user visits worker login and is worker/admin, redirect to dashboard
  if (pathname === '/worker/login' && (role === 'worker' || role === 'admin')) {
    return NextResponse.redirect(new URL('/worker/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg).*)',
  ],
}
