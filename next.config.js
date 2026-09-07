const isDevelopment = process.env.NODE_ENV === 'development'

// Production CSP: drop 'unsafe-inline' / 'unsafe-eval' for scripts. Next.js
// inlines some styles so we keep 'unsafe-inline' for `style-src` only.
const scriptSrc = isDevelopment
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self'"

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'X-Frame-Options', value: 'DENY' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com",
      // Stripe redirect: hosted checkout loads inside an iframe on return
      "frame-src 'self' https://checkout.stripe.com https://js.stripe.com",
      "form-action 'self' https://checkout.stripe.com",
      ...(isDevelopment ? [] : ['upgrade-insecure-requests']),
    ].join('; '),
  },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Slightly faster production builds: only emit source maps on demand
  // (CI sets this; local dev is unaffected).
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  compress: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        // Long-lived caching for static assets (Next.js auto-fingerprints them).
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // OG image and static svg assets: cache 1 day.
        source: '/og-image.svg',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
        ],
      },
      {
        source: '/icon.svg',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
