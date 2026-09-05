import { NextResponse } from 'next/server'
import { requireAdmin } from '../supabase/admin'
import { getServiceClient } from '../supabase/service'

export async function adminContext() {
  const auth = await requireAdmin()
  if (auth.error) return { response:NextResponse.json({ error:auth.error },{ status:auth.status }) }
  return { auth, db:getServiceClient() }
}

export async function audit(db,user,action,entityType,entityId,metadata={}) {
  await db.from('admin_audit_logs').insert({ actor_id:user.id, actor_user_id:user.id, action, entity_type:entityType, target_table:entityType, entity_id:entityId == null ? null : String(entityId), target_id:entityId == null ? null : String(entityId), metadata })
}

export const jsonError = (error,status=500) => NextResponse.json({ error:error?.message || String(error) },{ status })
