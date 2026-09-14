import { revalidatePath } from 'next/cache.js'
import { adminContext,jsonError,retiredAdminMutation } from '../../../../lib/admin/salon-api.js'
import { guardMutationRequest } from '../../../../lib/security/request-guards.js'
import { serviceInput } from '../../../../lib/validation/catalog.js'
export async function GET(){const ctx=await adminContext();if(ctx.response)return ctx.response;const {data,error}=await ctx.db.from('services').select('*,staff_services(staff_id)').order('sort_order');return error?jsonError(error):Response.json({services:data||[]})}
async function save(request,editing) {
  const guard=await guardMutationRequest(request,{rateLimit:{scope:'admin.services',limit:30,windowMs:60_000}});if(guard)return guard
  const ctx=await adminContext();if(ctx.response)return ctx.response
  try {
    const body=await request.json(),id=editing?body.id:null
    if(editing&&(!Number.isSafeInteger(id)||id<1))throw new Error('記錄編號不正確。')
    const {data,error}=await ctx.db.rpc('admin_save_service',{p_actor_id:ctx.auth.user.id,p_service_id:id,...serviceInput(body)})
    if(error)throw new Error('未能儲存服務，請檢查員工設定。')
    revalidatePath('/');revalidatePath('/services');revalidatePath('/booking')
    return Response.json({service:data},{status:editing?200:201})
  }catch(error){return jsonError(error,400)}
}
export const POST=request=>save(request,false)
export const PATCH=request=>save(request,true)
export const DELETE=retiredAdminMutation
