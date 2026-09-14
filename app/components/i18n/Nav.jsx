import Link from 'next/link'
import { t } from '../../../lib/i18n/dict'
import LanguageSwitcher from '../LanguageSwitcher'

/**
 * Shared top navigation rendered from translated keys. Server component.
 */
export default function Nav({ locale = 'zh-HK' }) {
  return (
    <header className="salon-nav">
      <div className="salon-wrap present-e3bae102" >
        <nav className="present-126244f1">
          <Link href="/">{t('common.brand', locale)}</Link>
          <Link href="/services">{t('nav.services', locale)}</Link>
          <Link href="/booking">{t('nav.booking', locale)}</Link>
          <Link href="/packages">{t('nav.packages', locale)}</Link>
          <Link href="/gallery">{t('nav.gallery', locale)}</Link>
          <Link href="/about">{t('nav.about', locale)}</Link>
          <Link href="/contact">{t('nav.contact', locale)}</Link>
        </nav>
        <LanguageSwitcher current={locale} />
      </div>
    </header>
  )
}
