import { NextResponse } from 'next/server'
import { adminContext, audit, jsonError } from '../../../../../lib/admin/salon-api'
import { guardMutationRequest } from '../../../../../lib/security/request-guards'
import { parseCsv } from '../../../../../lib/csv/parse'

const MAX_ROWS = 2_000

/**
 * POST /api/admin/services/import
 *
 * Body: { csv: string, dryRun?: boolean }
 *
 * Required CSV columns: name, price, duration_minutes
 * Optional: category, description, sort_order, published
 *
 * Match policy: upsert by name. `price` is in pence/HKD integer,
 * `duration_minutes` is integer minutes, `published` defaults to true.
 */
export async function POST(request) {
  const guard = await guardMutationRequest(request, { rateLimit: { scope: 'admin.services.import', limit: 5, windowMs: 3_600_000 } })
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

  const required = ['name', 'price', 'duration_minutes']
  const missing = required.filter((h) => !headers.includes(h))
  if (missing.length) return jsonError(`Missing required columns: ${missing.join(', ')}`)

  if (rows.length > MAX_ROWS) return jsonError(`Too many rows (${rows.length}). Limit is ${MAX_ROWS}.`)

  // Validate + normalise
  const errors = []
  const cleaned = []
  for (let i = 0; i < rows.length; i += 1) {
    const r = rows[i]
    const name = String(r.name || '').trim()
    const price = Number(r.price)
    const duration = Number(r.duration_minutes)
    if (!name || name.length > 200) errors.push({ row: i + 2, error: 'invalid name' })
    if (!Number.isFinite(price) || price < 0) errors.push({ row: i + 2, error: 'invalid price' })
    if (!Number.isFinite(duration) || duration < 15) errors.push({ row: i + 2, error: 'invalid duration_minutes (< 15)' })
    if (errors.length >= 50) break
    const published = r.published === undefined || r.published === ''
      ? true
      : /^(1|true|yes|y)$/i.test(String(r.published).trim())
    cleaned.push({
      name,
      price: Math.round(price),
      duration_minutes: Math.round(duration),
      category: r.category ? String(r.category).trim() : '其他',
      description: r.description ? String(r.description).trim() : null,
      sort_order: Number.isFinite(Number(r.sort_order)) ? Math.round(Number(r.sort_order)) : 0,
      published,
    })
  }
  if (errors.length) {
    return NextResponse.json({ error: 'Validation failed', errors: errors.slice(0, 50) }, { status: 400 })
  }

  // De-dup by name (last row wins)
  const byName = new Map()
  for (const row of cleaned) byName.set(row.name, row)
  const deduped = Array.from(byName.values())

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      totalRows: rows.length,
      uniqueByName: deduped.length,
      wouldInsertOrUpdate: deduped.length,
    })
  }

  const db = ctx.db
  let inserted = 0
  let updated = 0
  const failed = []

  for (const row of deduped) {
    try {
      const existing = await db.from('services').select('id').eq('name', row.name).maybeSingle()
      if (existing.error) { failed.push({ name: row.name, error: existing.error.message }); continue }
      if (existing.data) {
        const upd = await db.from('services').update(row).eq('id', existing.data.id)
        if (upd.error) { failed.push({ name: row.name, error: upd.error.message }); continue }
        updated += 1
      } else {
        const ins = await db.from('services').insert(row).select().single()
        if (ins.error) { failed.push({ name: row.name, error: ins.error.message }); continue }
        inserted += 1
      }
    } catch (err) {
      failed.push({ name: row.name, error: err?.message || String(err) })
    }
  }

  await audit(ctx.db, ctx.auth.user, 'service.import', 'services', null, {
    totalRows: rows.length, inserted, updated, failed: failed.length,
  })

  return NextResponse.json({ inserted, updated, failed: failed.length, failures: failed.slice(0, 50) })
}
