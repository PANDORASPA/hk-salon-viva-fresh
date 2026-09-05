import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function proxy(request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  let response = NextResponse.next()

  if (!supabaseUrl || !supabaseAnonKey) {
    return response
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value)
        })
        response = NextResponse.next()
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const adminAuthPath = '/admin/login'
  if (pathname.startsWith('/account') && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/signin'
    url.searchParams.set('redirectTo', pathname + request.nextUrl.search)
    return NextResponse.redirect(url)
  }

  if (pathname.startsWith('/admin') && pathname !== adminAuthPath) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = adminAuthPath
      url.searchParams.set('redirectTo', pathname + request.nextUrl.search)
      return NextResponse.redirect(url)
    }

    const { data: profile } = await supabase
      .from('admin_users')
      .select('is_active')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!profile?.is_active) {
      const url = request.nextUrl.clone()
      url.pathname = adminAuthPath
      url.searchParams.set('redirectTo', pathname + request.nextUrl.search)
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
