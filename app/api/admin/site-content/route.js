import { revalidatePath } from 'next/cache.js'
import { adminContext,jsonError } from '../../../../lib/admin/salon-api.js'
import { guardMutationRequest } from '../../../../lib/security/request-guards.js'
import { validateManagedContent } from '../../../../lib/content/public-contact.js'

export async function GET(){
  const context=await adminContext();if(context.response)return context.response
  const {data,error}=await context.db.from('site_content').select('data,updated_at').eq('id',1).single()
  return error?jsonError('未能載入網站內容。'):Response.json({content:data})
}
export async function PATCH(request){
  const guard=await guardMutationRequest(request,{rateLimit:{scope:'admin.site-content',limit:20,windowMs:60_000}});if(guard)return guard
  const context=await adminContext();if(context.response)return context.response
  try {
    const body=await request.json()
    if(!body||Object.keys(body).some(key=>key!=='data'))return jsonError('網站內容格式不正確。',400)
    const data=validateManagedContent(body.data)
    const {data:row,error}=await context.db.rpc('admin_save_site_content',{p_actor_id:context.auth.user.id,p_data:data})
    if(error)return jsonError('未能儲存網站內容；所有變更已撤回。',500)
    revalidatePath('/','layout');return Response.json({content:row})
  }catch(error){return jsonError(error,400)}
}
