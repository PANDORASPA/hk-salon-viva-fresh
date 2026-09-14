import { randomBytes } from 'node:crypto'

function contentSecurityPolicy(nonce, { development, https }) {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "script-src 'self' 'nonce-" + nonce + "' 'strict-dynamic'" + (development ? " 'unsafe-eval'" : ''),
    "script-src-attr 'none'",
    "style-src 'self' https://fonts.googleapis.com " + (development ? "'unsafe-inline'" : "'nonce-" + nonce + "'"),
    "style-src-attr " + (development ? "'unsafe-inline'" : "'none'"),
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com" + (development ? ' ws: http:' : ''),
    "frame-src 'self' https://checkout.stripe.com https://js.stripe.com",
    "form-action 'self' https://checkout.stripe.com",
    ...(!development && https ? ['upgrade-insecure-requests'] : []),
  ].join('; ')
}

// One nonce per document/RSC request, never shared or accepted from a caller.
// Inject NextResponse and the external Auth client so cookie/redirect behavior
// can be checked without contacting Supabase.
export function createCspProxy({ NextResponse, createServerClient, env = process.env }) {
  return async function proxy(request) {
    const nonce = randomBytes(24).toString('base64')
    const csp = contentSecurityPolicy(nonce, { development: env.NODE_ENV === 'development', https: request.nextUrl.protocol === 'https:' })
    const responseCookies = new Map()
    function finish(response) {
      response.headers.set('Content-Security-Policy', csp)
      // A document and its nonce must never be independently cached/replayed.
      response.headers.set('Cache-Control', 'private, no-store, max-age=0')
      for (const cookie of responseCookies.values()) response.cookies.set(cookie.name, cookie.value, cookie.options)
      return response
    }
    function next() {
      const headers = new Headers(request.headers)
      headers.set('x-nonce', nonce)
      headers.set('Content-Security-Policy', csp)
      return finish(NextResponse.next({ request: { headers } }))
    }
    function signIn(pathname) {
      const url = request.nextUrl.clone()
      url.pathname = pathname
      url.searchParams.set('redirectTo', request.nextUrl.pathname + request.nextUrl.search)
      return finish(NextResponse.redirect(url))
    }

    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnonKey) return next()
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, { cookies: {
      getAll() { return request.cookies.getAll() },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          request.cookies.set(cookie.name, cookie.value)
          responseCookies.set(cookie.name, cookie)
        }
      },
    } })
    const { data: { user } } = await supabase.auth.getUser()
    const pathname = request.nextUrl.pathname
    if (pathname.startsWith('/account') && !user) return signIn('/signin')
    if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
      if (!user) return signIn('/admin/login')
      const { data: profile } = await supabase.from('admin_users').select('is_active').eq('user_id', user.id).maybeSingle()
      if (!profile?.is_active) return signIn('/admin/login')
    }
    return next()
  }
}
