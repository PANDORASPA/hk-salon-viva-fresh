import { NextResponse } from 'next/server'
import { getServiceClient } from '../../../../../lib/supabase/service'
import { adminContext, audit, jsonError } from '../../../../../lib/admin/salon-api'
import { guardMutationRequest } from '../../../../../lib/security/request-guards'
import { parseCsv } from '../../../../../lib/csv/parse'

const MAX_ROWS = 5_000

/**
 * POST /api/admin/customers/import
 *
 * Body: { csv: string, dryRun?: boolean }
 *   csv: the full CSV text (header + rows)
 *   dryRun: when true, validate but do not write
 *
 * Required CSV columns: name, phone
 * Optional columns: email, notes
 *
 * Match policy: upsert by phone (which is UNIQUE in `customers`). If a
 * matching customer exists, update `name`, `email`, `notes`. Otherwise
 * insert a new row.
 */
export async function POST(request) {
  const guard = await guardMutationRequest(request, { rateLimit: { scope: 'admin.customers.import', limit: 5, windowMs: 3_600_000 } })
  if (guard) return guard

  const ctx = await adminContext()
  if (ctx.response) return ctx.response

  let body
  try { body = await request.json() } catch { return jsonError('Body must be JSON.') }
  const { csv, dryRun = false } = body || {}
  if (typeof csv !== 'string' || !csv.trim()) return jsonError('csv string required.')

  let parsed
  try { parsed = parseCsv(csv) } catch (err) { return jsonError(`CSV parse failed: ${err.message}`) }
  const { headers, rows } = parsed
  if (rows.length === 0) return jsonError('No data rows after header.')

  const required = ['name', 'phone']
  const optional = ['email', 'notes']
  const missing = required.filter((h) => !headers.includes(h))
  if (missing.length) return jsonError(`Missing required columns: ${missing.join(', ')}`)

  if (rows.length > MAX_ROWS) {
    return jsonError(`Too many rows (${rows.length}). Limit is ${MAX_ROWS}.`)
  }

  // Validate rows client-side so we can return a useful error report
  const errors = []
  const cleaned = []
  for (let i = 0; i < rows.length; i += 1) {
    const r = rows[i]
    const name = String(r.name || '').trim()
    const phone = String(r.phone || '').trim()
    if (!name || name.length > 120) errors.push({ row: i + 2, error: 'invalid name' })
    if (!phone || phone.length < 5 || phone.length > 30) errors.push({ row: i + 2, error: 'invalid phone' })
    if (errors.length >= 50) break
    cleaned.push({
      name,
      phone,
      email: r.email ? String(r.email).trim().toLowerCase() : null,
      notes: r.notes ? String(r.notes).trim() : null,
    })
  }
  if (errors.length) {
    return NextResponse.json({ error: 'Validation failed', errors: errors.slice(0, 50) }, { status: 400 })
  }

  // De-duplicate within the batch by phone (last row wins)
  const byPhone = new Map()
  for (const row of cleaned) byPhone.set(row.phone, row)
  const deduped = Array.from(byPhone.values())

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      totalRows: rows.length,
      uniqueByPhone: deduped.length,
      wouldInsertOrUpdate: deduped.length,
    })
  }

  // Upsert by phone. The customers table has UNIQUE(phone), so this is safe.
  const db = ctx.db
  let inserted = 0
  let updated = 0
  const failed = []
  for (const row of deduped) {
    try {
      // First: see if it exists
      const existing = await db.from('customers').select('id').eq('phone', row.phone).maybeSingle()
      if (existing.error) {
        failed.push({ phone: row.phone, error: existing.error.message })
        continue
      }
      if (existing.data) {
        const upd = await db.from('customers')
          .update({ name: row.name, email: row.email, notes: row.notes })
          .eq('id', existing.data.id)
        if (upd.error) { failed.push({ phone: row.phone, error: upd.error.message }); continue }
        updated += 1
      } else {
        const ins = await db.from('customers').insert(row).select().single()
        if (ins.error) { failed.push({ phone: row.phone, error: ins.error.message }); continue }
        inserted += 1
      }
    } catch (err) {
      failed.push({ phone: row.phone, error: err?.message || String(err) })
    }
  }

  await audit(ctx.db, ctx.auth.user, 'customer.import', 'customers', null, {
    totalRows: rows.length,
    inserted, updated, failed: failed.length,
  })

  return NextResponse.json({
    inserted,
    updated,
    failed: failed.length,
    failures: failed.slice(0, 50),
  })
}
