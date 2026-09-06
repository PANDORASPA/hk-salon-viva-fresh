import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  try {
    const body = await request.json()
    const { packageId, customerName, customerPhone, customerEmail, notes } = body

    // Validate
    if (!packageId || !customerName || !customerPhone) {
      return NextResponse.json({ error: '缺少必要資料。' }, { status: 400 })
    }

    if (customerPhone.trim().length < 5) {
      return NextResponse.json({ error: '請輸入有效的電話號碼。' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Supabase not configured.' }, { status: 500 })
    }
    const db = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } })

    // Get package info
    const { data: pkg, error: pkgError } = await db
      .from('packages')
      .select('id, name, price_hkd, total_sessions')
      .eq('id', Number(packageId))
      .eq('is_active', true)
      .single()

    if (pkgError || !pkg) {
      return NextResponse.json({ error: '找不到該套票或套票已停售。' }, { status: 404 })
    }

    // Find or create customer
    let { data: customer } = await db
      .from('customers')
      .select('id, name')
      .eq('phone', customerPhone.trim())
      .single()

    if (!customer) {
      const { data: newCustomer, error: custError } = await db
        .from('customers')
        .insert({
          name: customerName.trim(),
          phone: customerPhone.trim(),
          email: customerEmail || null,
          notes: `[套票查詢] ${notes || ''}`.trim(),
        })
        .select('id, name')
        .single()

      if (custError) {
        console.error('Customer create error:', custError)
        return NextResponse.json({ error: '無法處理你的請求，請稍後再試。' }, { status: 500 })
      }
      customer = newCustomer
    }

    // Log the package inquiry (for admin tracking)
    const { error: logError } = await db
      .from('site_content')
      .insert({
        content_key: `package_inquiry_${Date.now()}`,
        content_value: JSON.stringify({
          type: 'package_inquiry',
          customer_id: customer.id,
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          customer_email: customerEmail || null,
          package_id: pkg.id,
          package_name: pkg.name,
          package_price: pkg.price_hkd,
          package_sessions: pkg.total_sessions,
          notes: notes || null,
          created_at: new Date().toISOString(),
        }),
      })

    if (logError) {
      console.error('Package inquiry log error:', logError)
    }

    return NextResponse.json({
      success: true,
      message: '已收到你的查詢，我們會盡快聯繫你。',
      customer: { id: customer.id, name: customer.name },
      package: { id: pkg.id, name: pkg.name, price: pkg.price_hkd },
    })
  } catch (err) {
    console.error('Package purchase error:', err)
    return NextResponse.json({ error: '伺服器錯誤，請稍後再試。' }, { status: 500 })
  }
}
