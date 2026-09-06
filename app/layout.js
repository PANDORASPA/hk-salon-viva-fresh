import './globals.css'
import CookieBanner from './components/CookieBanner'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://hk-salon-viva-fresh.vercel.app'
const gaId = process.env.NEXT_PUBLIC_GA_ID

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'SALON POKE BY VIVA | 爆毛術脫髮護理', template: '%s | SALON POKE BY VIVA' },
  description: '超過20年專業經驗，專精剪髮、染髮、電髮及頭髮修護。亞洲人髮絲專家，香港市中心工作室。',
  keywords: ['爆毛術', '脫髮護理', '頭髮護理', '香港脫髮', 'SALON POKE BY VIVA'],
  openGraph: {
    type: 'website',
    locale: 'zh_HK',
    url: siteUrl,
    siteName: 'SALON POKE BY VIVA',
    title: 'SALON POKE BY VIVA | 爆毛術脫髮護理',
    description: '超過20年專業經驗，專精剪髮、染髮、電髮及頭髮修護。',
  },
}

// JSON-LD structured data for LocalBusiness / BeautySalon
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BeautySalon',
  name: 'SALON POKE BY VIVA',
  description: '超過20年專業經驗，專精剪髮、染髮、電髮及頭髮修護。亞洲人髮絲專家。',
  url: siteUrl,
  areaServed: { '@type': 'City', name: '香港' },
  priceRange: '$$',
  openingHours: 'Mo-Sa 10:00-19:00',
  telephone: '待提供',
  image: `${siteUrl}/og-image.svg`,
  sameAs: [],
}

export const viewport = { width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }) {
  return (
    <html lang="zh-HK">
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Inter:wght@400;500&display=swap" rel="stylesheet" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        {children}
        {/* Google Analytics */}
        {gaId && (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments)} gtag('js', new Date()); gtag('config', '${gaId}');`,
              }}
            />
          </>
        )}
        <CookieBanner />
      </body>
    </html>
  )
}
