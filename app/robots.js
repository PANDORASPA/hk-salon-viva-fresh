export default function robots() {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin/', '/api/'] },
    sitemap: 'https://salonpokeviva.com/sitemap.xml',
  }
}
