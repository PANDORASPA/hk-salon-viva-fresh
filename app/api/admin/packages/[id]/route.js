import { adminContext,jsonError,routeRecordId,retiredAdminMutation,manageAdminRecord } from '../../../../../lib/admin/salon-api.js'
import { guardMutationRequest } from '../../../../../lib/security/request-guards.js'
import { packageInput } from '../../../../../lib/validation/catalog.js'
export async function GET(request,context){const ctx=await adminContext();if(ctx.response)return ctx.response;const id=await routeRecordId(request,context);if(!Number.isSafeInteger(id)||id<1)return jsonError('記錄編號不正確。',400);const {data,error}=await ctx.db.from('packages').select('*,package_services(service_id,services(name,id))').eq('id',id).single();return error?jsonError(error):Response.json({package:data})}
export async function PATCH(request,context) {
  const guard=await guardMutationRequest(request,{rateLimit:{scope:'admin.packages',limit:30,windowMs:60_000}});if(guard)return guard
  const ctx=await adminContext();if(ctx.response)return ctx.response
  try {
    const id=await routeRecordId(request,context),body=await request.json()
    if(!Number.isSafeInteger(id)||id<1)throw new Error('記錄編號不正確。')
    if(Object.hasOwn(body,'isActive'))return Response.json({package:await manageAdminRecord(ctx,'package_state',id,body)})
    const {data,error}=await ctx.db.rpc('admin_save_package',{p_actor_id:ctx.auth.user.id,p_package_id:id,...packageInput(body)})
    if(error)throw new Error('未能儲存套票，請檢查適用服務。')
    return Response.json({package:data})
  }catch(error){return jsonError(error,400)}
}
export const DELETE=retiredAdminMutation
