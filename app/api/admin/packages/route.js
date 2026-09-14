import { adminContext,jsonError } from '../../../../lib/admin/salon-api.js'
import { guardMutationRequest } from '../../../../lib/security/request-guards.js'
import { packageInput } from '../../../../lib/validation/catalog.js'
export async function GET(){const ctx=await adminContext();if(ctx.response)return ctx.response;const {data,error}=await ctx.db.from('packages').select('*,package_services(service_id,services(name))').order('created_at',{ascending:false});return error?jsonError(error):Response.json({packages:data||[]})}
export async function POST(request) {
  const guard=await guardMutationRequest(request,{rateLimit:{scope:'admin.packages',limit:30,windowMs:60_000}});if(guard)return guard
  const ctx=await adminContext();if(ctx.response)return ctx.response
  try {
    const {data,error}=await ctx.db.rpc('admin_save_package',{p_actor_id:ctx.auth.user.id,p_package_id:null,...packageInput(await request.json())})
    if(error)throw new Error('未能儲存套票，請檢查適用服務。')
    return Response.json({package:data},{status:201})
  }catch(error){return jsonError(error,400)}
}
