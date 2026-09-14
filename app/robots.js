import { publicSiteUrl } from '../lib/content/public-contact.js'

// robots.txt for the public site. /admin and /api are explicitly disallowed
// to keep internal endpoints and customer data out of the search index.
//
// The marketing and booking pages are all allowed. We do not currently
// disallow /account or /signin — they're noindex'd via metadata in the
// page modules instead, so a stray crawler still sees a 200 → "noindex"
// rather than a 403 from robots.

export default function robots() {
  const base = publicSiteUrl(process.env.NEXT_PUBLIC_SITE_URL)
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/admin/*', '/api', '/api/*', '/account', '/account/*'],
      },
    ],
    ...(base ? { sitemap: `${base}/sitemap.xml`, host: base } : {}),
  }
}
