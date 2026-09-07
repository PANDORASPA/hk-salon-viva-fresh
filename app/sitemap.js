// Sitemap for the public marketing site. The auth and admin areas are
// disallowed in robots.js and intentionally omitted here.
//
// We use a static date (the build/deploy date) so the sitemap output is
// deterministic and the page-render cost stays near zero. Search engines
// that care about exact lastModified dates get the deploy timestamp;
// everyone else is happy with the per-section cadence below.

const DEPLOY_DATE = '2026-09-07'

const STATIC_PAGES = [
  { path: '/', priority: 1.0, changeFrequency: 'weekly' },
  { path: '/booking', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/packages', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/services', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/about', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/contact', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/gallery', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/location', priority: 0.5, changeFrequency: 'monthly' },
]

export default function sitemap() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://salonpokeviva.com'
  return STATIC_PAGES.map(({ path, priority, changeFrequency }) => ({
    url: `${base}${path}`,
    lastModified: DEPLOY_DATE,
    changeFrequency,
    priority,
  }))
}
