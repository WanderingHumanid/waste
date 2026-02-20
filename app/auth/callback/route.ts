import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    try {
      const supabase = await createClient()
      
      // Exchange code for session - this will automatically store tokens in cookies
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        console.error('Auth exchange error:', error)
        return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`)
      }

      if (data?.session?.user) {
        const user = data.session.user
        
        // Check if profile exists
        let { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        // Create profile if it doesn't exist (new OAuth user)
        if (!profile) {
          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: user.id,
              full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
              avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
              role: 'citizen', // Default role for new users
              green_credits: 0,
              preferred_language: 'en',
            })
            .select('role')
            .single()
          
          if (insertError) {
            console.error('Profile creation error:', insertError)
          }
          
          profile = newProfile
        }

        // Redirect based on role
        if (profile?.role === 'admin') {
          return NextResponse.redirect(`${origin}/admin/dashboard`)
        } else if (profile?.role === 'worker') {
          return NextResponse.redirect(`${origin}/worker/dashboard`)
        }
      }

      // Default redirect if no user or profile info
      return NextResponse.redirect(`${origin}${next}`)
    } catch (error) {
      console.error('Callback error:', error)
      return NextResponse.redirect(`${origin}/login?error=callback_error`)
    }
  }

  // No code provided
  return NextResponse.redirect(`${origin}/login?error=no_code`)
}
