import { NextResponse } from 'next/server.js'
import { revalidatePath } from 'next/cache.js'
import { adminContext, audit, jsonError } from '../../../../lib/admin/salon-api.js'
import { guardMutationRequest } from '../../../../lib/security/request-guards.js'
import { validateStaffInput } from '../../../../lib/validation/staff.js'

const rpcInput = value => ({
  p_name: value.name, p_display_name: value.displayName, p_bio: value.bio, p_colour_hex: value.colourHex,
  p_is_active: value.isActive, p_sort_order: value.sortOrder, p_service_ids: value.serviceIds,
})
const auditValue = value => ({ ...value })
const toStaff = (row, serviceIds = []) => row && ({
  id: row.id, name: row.name, displayName: row.display_name, bio: row.bio, colourHex: row.colour_hex,
  isActive: row.is_active, sortOrder: row.sort_order, serviceIds,
})
const commandError = error => {
  const message = String(error?.message || error || '')
  if (message.includes('invalid_staff_payload')) return jsonError('Invalid staff.', 400)
  return jsonError('Unable to save staff.', 500)
}
const invalidateStaff = revalidate => {
  revalidate('/admin')
  revalidate('/booking')
}

export function createStaffHandlers({
  adminContext: resolveContext = adminContext,
  guardMutationRequest: guardMutation = guardMutationRequest,
  audit: writeAudit = audit,
  revalidatePath: revalidate = revalidatePath,
} = {}) {
  return {
    async GET() {
      const context = await resolveContext()
      if (context.response) return context.response
      const { data, error } = await context.db.from('staff')
        .select('id,name,display_name,bio,colour_hex,is_active,sort_order,staff_services(service_id)')
        .order('sort_order').order('id')
      if (error) return jsonError('Unable to load staff.', 500)
      return NextResponse.json({ staff: (data || []).map(row => toStaff(row, (row.staff_services || []).map(link => link.service_id))) })
    },
    async POST(request) {
      const guard = await guardMutation(request, { rateLimit: { scope: 'admin.staff', limit: 30, windowMs: 60_000 } })
      if (guard) return guard
      const context = await resolveContext()
      if (context.response) return context.response
      const body = await request.json().catch(() => null)
      const parsed = validateStaffInput(body)
      if (!parsed.ok) return jsonError('Invalid staff.', 400)
      const { data, error } = await context.db.rpc('admin_create_staff', rpcInput(parsed.value))
      if (error) return commandError(error)
      const staff = toStaff(data, parsed.value.serviceIds)
      await writeAudit(context.db, context.auth.user, 'staff.create', 'staff', data.id, { after: auditValue(parsed.value) })
      invalidateStaff(revalidate)
      return NextResponse.json({ staff }, { status: 201 })
    },
  }
}

export async function GET(request) { return createStaffHandlers().GET(request) }
export async function POST(request) { return createStaffHandlers().POST(request) }
