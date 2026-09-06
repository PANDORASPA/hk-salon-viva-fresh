import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    const body = await req.json()
    const { name, phone, email, message } = body || {}

    if (!name?.trim() || !message?.trim()) {
      return NextResponse.json({ error: '姓名和訊息為必填' }, { status: 400 })
    }

    // Log the inquiry — admin can monitor via admin panel or Supabase dashboard
    const { createClient } = await import('@supabase/supabase-js')
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (url && key) {
      const db = createClient(url, key)
      await db.from('contact_inquiries').insert({
        name: name.trim(),
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        message: message.trim(),
        status: 'new',
      }).select('id')
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[contact API]', err)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
