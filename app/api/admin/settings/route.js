import { adminContext, jsonError } from '../../../../lib/admin/salon-api.js'
import { guardMutationRequest } from '../../../../lib/security/request-guards.js'
import { mergeSettings, readAppSettings, validateSettings } from '../../../../lib/settings/app-settings.js'

export async function GET() {
  const context=await adminContext()
  if(context.response)return context.response
  return Response.json({settings:await readAppSettings(context.db)})
}
export async function PATCH(request) {
  const denied=await guardMutationRequest(request,{rateLimit:{scope:'admin.settings',limit:20,windowMs:60_000}})
  if(denied)return denied
  const context=await adminContext()
  if(context.response)return context.response
  try {
    const body=await request.json()
    if(!body||Object.keys(body).some(key=>key!=='settings'))return jsonError('設定格式不正確。',400)
    const input=validateSettings(body.settings)
    const merged=mergeSettings({...await readAppSettings(context.db),...input})
    const {data,error}=await context.db.rpc('admin_save_settings',{p_actor_id:context.auth.user.id,p_data:merged})
    if(error)return jsonError('未能儲存設定；所有變更已撤回。',500)
    return Response.json({settings:mergeSettings(data?.data)})
  }catch(error){return jsonError(error,400)}
}
