export default function sitemap() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://salonpokeviva.com'
  return [
    { url: base, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/services`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/booking`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/gallery`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
  ]
}
