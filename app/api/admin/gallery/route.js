import { revalidatePath } from 'next/cache.js'
import { adminContext,jsonError,manageAdminRecord } from '../../../../lib/admin/salon-api.js'
import { guardMutationRequest } from '../../../../lib/security/request-guards.js'
const refresh=()=>{revalidatePath('/');revalidatePath('/gallery')}
async function context(request) { const guard=await guardMutationRequest(request,{rateLimit:{scope:'admin.gallery',limit:20,windowMs:60_000}}); return guard?{response:guard}:adminContext() }
export async function GET(){const ctx=await adminContext();if(ctx.response)return ctx.response;const {data,error}=await ctx.db.from('gallery_images').select('*').order('sort_order');return error?jsonError(error):Response.json({images:data||[]})}
export async function POST(request){
  const ctx=await context(request);if(ctx.response)return ctx.response
  let path
  try {
    const form=await request.formData(),file=form.get('file')
    if(!file||typeof file.arrayBuffer!=='function'||file.size>10*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))return jsonError('請使用 10 MB 以下的 JPG、PNG 或 WebP。',400)
    path=crypto.randomUUID()+'.'+({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type])
    const upload=await ctx.db.storage.from('salon-gallery').upload(path,await file.arrayBuffer(),{contentType:file.type,upsert:false})
    if(upload.error)throw new Error('圖片上載失敗。')
    const image=await manageAdminRecord(ctx,'gallery_create',null,{storagePath:path,altText:String(form.get('altText')||'').trim(),caption:String(form.get('caption')||''),published:true,sortOrder:Number(form.get('sortOrder')||0)})
    refresh();return Response.json({image},{status:201})
  }catch(error){
    if(path) { const cleanup=await ctx.db.storage.from('salon-gallery').remove([path]); if(cleanup.error)return jsonError('儲存失敗；上載檔案清理失敗，請管理員檢查圖庫儲存空間。',500) }
    return jsonError(error,400)
  }
}
export async function PATCH(request){
  const ctx=await context(request);if(ctx.response)return ctx.response
  try {const {id,...body}=await request.json();const image=await manageAdminRecord(ctx,'gallery_update',id,body);refresh();return Response.json({image})}catch(error){return jsonError(error,400)}
}
export async function DELETE(request){
  const ctx=await context(request);if(ctx.response)return ctx.response
  try {
    const id=Number(new URL(request.url).searchParams.get('id'))
    const {data:row,error}=await ctx.db.from('gallery_images').select('storage_path').eq('id',id).single()
    if(error)throw new Error('找不到圖片。')
    await manageAdminRecord(ctx,'gallery_delete',id,{})
    let cleanupWarning=false
    if(!row.storage_path.startsWith('local/')) { const cleanup=await ctx.db.storage.from('salon-gallery').remove([row.storage_path]);cleanupWarning=Boolean(cleanup.error) }
    refresh();return Response.json({success:true,cleanupWarning})
  }catch(error){return jsonError(error,400)}
}
