import { createClient } from '@supabase/supabase-js'
import defaultsModule from '../../content/salon-poke-defaults'

const { salonDefaults } = defaultsModule

const storageUrl = (path) => {
  if (path.startsWith('local/')) return `/gallery/${path.slice('local/'.length)}`
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/salon-gallery/${path}`
}

export async function getPublicSalonContent() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return salonDefaults

  try {
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    const [servicesResult, galleryResult, contentResult] = await Promise.all([
      db.from('services').select('id,name,price,duration_minutes,category,description,sort_order').eq('published', true).eq('enabled', true).order('sort_order'),
      db.from('gallery_images').select('id,storage_path,alt_text,caption,sort_order').eq('published', true).order('sort_order'),
      db.from('site_content').select('data').eq('id', 1).maybeSingle(),
    ])

    const managed = contentResult.data?.data || {}
    return {
      ...salonDefaults,
      ...managed,
      identity: { ...salonDefaults.identity, ...(managed.identity || {}) },
      contact: { ...salonDefaults.contact, ...(managed.contact || {}) },
      services: servicesResult.data?.length ? servicesResult.data.map((row) => ({ id:row.id,name:row.name,pricePence:row.price,durationMinutes:row.duration_minutes,category:row.category,description:row.description || '' })) : salonDefaults.services,
      gallery: galleryResult.data?.length ? galleryResult.data.map((row) => ({ id:row.id,path:storageUrl(row.storage_path),alt:row.alt_text,label:row.caption || row.alt_text })) : salonDefaults.gallery,
    }
  } catch {
    return salonDefaults
  }
}
