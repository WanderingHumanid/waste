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
          cookiesToSet.forEach(({ name, value, options }) =>
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

  // Check authentication - use getUser() for server-side verification
  const { data: { user }, error } = await supabase.auth.getUser()

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
  if ((!user || error) && !isPublicRoute) {
    const redirectUrl = new URL('/login', request.url)
    if (pathname !== '/') {
      redirectUrl.searchParams.set('next', pathname)
    }
    return NextResponse.redirect(redirectUrl)
  }

  // If user is logged in and trying to access login pages or root, redirect based on role
  if (user && (pathname === '/login' || pathname === '/register' || pathname === '/')) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    console.log('[Middleware] User:', user.email, 'Role:', profile?.role, 'Error:', profileError?.message)

    if (profile?.role === 'admin') {
      console.log('[Middleware] Redirecting admin to /admin/dashboard')
      return NextResponse.redirect(new URL('/admin/dashboard', request.url))
    } else if (profile?.role === 'worker') {
      return NextResponse.redirect(new URL('/worker/dashboard', request.url))
    }
    console.log('[Middleware] Redirecting citizen to /dashboard')
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Protect all /admin/* routes (except /admin/login)
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    if (!user) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (profile?.role !== 'admin') {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  // If logged in user visits admin login, check if they're admin
  if (user && pathname === '/admin/login') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role === 'admin') {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url))
    }
  }

  // If logged in user visits worker login, check if they're worker
  if (user && pathname === '/worker/login') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
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
