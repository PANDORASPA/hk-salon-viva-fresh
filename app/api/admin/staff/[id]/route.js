import { NextResponse } from 'next/server.js'
import { revalidatePath } from 'next/cache.js'
import { adminContext, audit, jsonError } from '../../../../../lib/admin/salon-api.js'
import { guardMutationRequest } from '../../../../../lib/security/request-guards.js'
import { isPositiveSafeInteger, validateStaffInput } from '../../../../../lib/validation/staff.js'

const toStaff = (row, serviceIds = []) => row && ({ id: row.id, name: row.name, displayName: row.display_name,
  bio: row.bio, colourHex: row.colour_hex, isActive: row.is_active, sortOrder: row.sort_order, serviceIds })
const toAudit = value => ({ ...value })
const rpcInput = value => ({ p_name: value.name, p_display_name: value.displayName, p_bio: value.bio,
  p_colour_hex: value.colourHex, p_is_active: value.isActive, p_sort_order: value.sortOrder, p_service_ids: value.serviceIds })
const commandError = error => {
  const message = String(error?.message || error || '')
  if (message.includes('staff_not_found')) return jsonError('Staff member not found.', 404)
  if (message.includes('staff_has_future_appointments')) return jsonError('Reassign or cancel future appointments before deactivating this staff member.', 409)
  if (message.includes('staff_has_appointments')) return jsonError('Staff with appointment history cannot be deleted.', 409)
  if (message.includes('invalid_staff_payload')) return jsonError('Invalid staff.', 400)
  return jsonError('Unable to save staff.', 500)
}
const parseId = async context => {
  const id = Number((await context.params).id)
  return isPositiveSafeInteger(id) ? id : null
}
const invalidate = revalidate => { revalidate('/admin'); revalidate('/booking') }

async function defaultLoadStaff(db, id) {
  const { data, error } = await db.from('staff').select('id,name,display_name,bio,colour_hex,is_active,sort_order,staff_services(service_id)').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? toStaff(data, (data.staff_services || []).map(link => link.service_id)) : null
}

export function createStaffDetailHandlers({
  adminContext: resolveContext = adminContext,
  guardMutationRequest: guardMutation = guardMutationRequest,
  audit: writeAudit = audit,
  loadStaff = defaultLoadStaff,
  revalidatePath: revalidate = revalidatePath,
} = {}) {
  return {
    async GET(_request, routeContext) {
      const context = await resolveContext()
      if (context.response) return context.response
      const id = await parseId(routeContext)
      if (!id) return jsonError('Invalid staff.', 400)
      try {
        const staff = await loadStaff(context.db, id)
        return staff ? NextResponse.json({ staff }) : jsonError('Staff member not found.', 404)
      } catch { return jsonError('Unable to load staff.', 500) }
    },
    async PATCH(request, routeContext) {
      const guard = await guardMutation(request, { rateLimit: { scope: 'admin.staff', limit: 30, windowMs: 60_000 } })
      if (guard) return guard
      const context = await resolveContext()
      if (context.response) return context.response
      const id = await parseId(routeContext)
      if (!id) return jsonError('Invalid staff.', 400)
      const parsed = validateStaffInput(await request.json().catch(() => null))
      if (!parsed.ok) return jsonError('Invalid staff.', 400)
      let before
      try { before = await loadStaff(context.db, id) } catch { return jsonError('Unable to load staff.', 500) }
      if (!before) return jsonError('Staff member not found.', 404)
      const { data, error } = await context.db.rpc('admin_update_staff', { p_staff_id: id, ...rpcInput(parsed.value) })
      if (error) return commandError(error)
      const staff = toStaff(data, parsed.value.serviceIds)
      await writeAudit(context.db, context.auth.user, 'staff.update', 'staff', id, { before: toAudit(before), after: toAudit(parsed.value) })
      invalidate(revalidate)
      return NextResponse.json({ staff })
    },
    async DELETE(request, routeContext) {
      const guard = await guardMutation(request, { rateLimit: { scope: 'admin.staff', limit: 30, windowMs: 60_000 } })
      if (guard) return guard
      const context = await resolveContext()
      if (context.response) return context.response
      const id = await parseId(routeContext)
      if (!id) return jsonError('Invalid staff.', 400)
      let before
      try { before = await loadStaff(context.db, id) } catch { return jsonError('Unable to load staff.', 500) }
      if (!before) return jsonError('Staff member not found.', 404)
      const { error } = await context.db.rpc('admin_delete_staff', { p_staff_id: id })
      if (error) return commandError(error)
      await writeAudit(context.db, context.auth.user, 'staff.delete', 'staff', id, { before: toAudit(before) })
      invalidate(revalidate)
      return NextResponse.json({ success: true })
    },
  }
}

export async function GET(request, context) { return createStaffDetailHandlers().GET(request, context) }
export async function PATCH(request, context) { return createStaffDetailHandlers().PATCH(request, context) }
export async function DELETE(request, context) { return createStaffDetailHandlers().DELETE(request, context) }
