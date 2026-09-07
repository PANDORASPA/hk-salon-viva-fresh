'use client'
import { useCallback,useEffect,useState } from 'react'

const api=async(url,options={})=>{const response=await fetch(url,{...options,headers:{...(options.body instanceof FormData?{}:{'Content-Type':'application/json'}),...(options.headers||{})}});const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.error||'Request failed.');return payload}
const useResource=(path,key)=>{const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');const load=useCallback(async()=>{setLoading(true);setError('');try{setRows((await api(path))[key]||[])}catch(e){setError(e.message)}finally{setLoading(false)}},[path,key]);useEffect(()=>{load()},[load]);return{rows,setRows,loading,error,load}}
const State=({loading,error,children})=>loading?<p>Loading…</p>:error?<p role="alert" className="salon-error">{error}</p>:children
const Button=({children,...props})=><button className="admin-action" {...props}>{children}</button>

export function AppointmentsModule(){const r=useResource('/api/admin/appointments','appointments'),update=async(row,status)=>{await api('/api/admin/appointments',{method:'PATCH',body:JSON.stringify({id:row.id,status,adminNotes:row.admin_notes||''})});r.load()};return <Module title="Appointments" intro="Confirm, complete, cancel or mark client appointments as no-show."><State {...r}><div className="admin-list">{r.rows.map(row=><article key={row.id}><div><strong>{row.reference} · {row.customer_name}</strong><p>{new Date(row.starts_at).toLocaleString('zh-HK',{timeZone:'Asia/Hong_Kong',dateStyle:'short',timeStyle:'short',hour12:false})} · {row.services?.name}</p><p>{row.customer_phone} {row.customer_email||''}</p></div><div><span className={`status ${row.status}`}>{row.status}</span>{['confirmed','completed','cancelled','no_show'].map(status=><Button key={status} onClick={()=>update(row,status)}>{status}</Button>)}</div></article>)}</div></State></Module>}

const emptyService={name:'',price:0,durationMinutes:60,category:'Haircut',description:'',published:true,sortOrder:0}
export function ServicesModule(){const r=useResource('/api/admin/services','services'),[draft,setDraft]=useState(emptyService),[editing,setEditing]=useState(null),save=async(event)=>{event.preventDefault();await api('/api/admin/services',{method:editing?'PATCH':'POST',body:JSON.stringify(editing?{...draft,id:editing}:draft)});setDraft(emptyService);setEditing(null);r.load()},edit=row=>{setEditing(row.id);setDraft({name:row.name,price:row.price,durationMinutes:row.duration_minutes,category:row.category,description:row.description||'',published:row.published,sortOrder:row.sort_order})},toggle=async(row)=>{await api('/api/admin/services',{method:'PATCH',body:JSON.stringify({id:row.id,name:row.name,price:row.price,durationMinutes:row.duration_minutes,category:row.category,description:row.description,published:!row.published,sortOrder:row.sort_order})});r.load()};return <Module title="Services & prices" intro="Add or edit the public menu, guide price, duration and publication state."><form className="admin-inline-form" onSubmit={save}><input aria-label="Service name" placeholder="Service name" value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} required/><input aria-label="Price in pence" type="number" min="0" value={draft.price} onChange={e=>setDraft({...draft,price:Number(e.target.value)})}/><input aria-label="Duration" type="number" min="15" value={draft.durationMinutes} onChange={e=>setDraft({...draft,durationMinutes:Number(e.target.value)})}/><input aria-label="Category" value={draft.category} onChange={e=>setDraft({...draft,category:e.target.value})}/><input aria-label="Description" placeholder="Description" value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/><Button>{editing?'Save changes':'Add service'}</Button>{editing?<Button type="button" onClick={()=>{setEditing(null);setDraft(emptyService)}}>Cancel</Button>:null}</form><State {...r}><div className="admin-list">{r.rows.map(row=><article key={row.id}><div><strong>{row.name}</strong><p>{row.category} · £{(row.price/100).toFixed(2)} · {row.duration_minutes} min</p></div><div><Button onClick={()=>edit(row)}>Edit</Button><Button onClick={()=>toggle(row)}>{row.published?'Unpublish':'Publish'}</Button></div></article>)}</div></State></Module>}

export function ScheduleModule(){const [hours,setHours]=useState([]),[blocked,setBlocked]=useState([]),[error,setError]=useState(''),load=async()=>{try{const data=await api('/api/admin/schedule');setHours(data.hours);setBlocked(data.blockedDates)}catch(e){setError(e.message)}};useEffect(()=>{load()},[]);const save=async()=>{await api('/api/admin/schedule',{method:'POST',body:JSON.stringify({type:'hours',hours})});load()},block=async(event)=>{event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget));await api('/api/admin/schedule',{method:'POST',body:JSON.stringify(data)});event.currentTarget.reset();load()};return <Module title="Schedule" intro="Set weekly opening hours and exceptional closed dates.">{error?<p className="salon-error">{error}</p>:null}<div className="hours-grid">{hours.map((row,index)=><label key={row.weekday}><span>{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][row.weekday]}</span><input type="checkbox" checked={row.is_open} onChange={e=>setHours(hours.map((item,i)=>i===index?{...item,is_open:e.target.checked}:item))}/><input type="time" disabled={!row.is_open} value={row.opens_at?.slice(0,5)||''} onChange={e=>setHours(hours.map((item,i)=>i===index?{...item,opens_at:e.target.value}:item))}/><input type="time" disabled={!row.is_open} value={row.closes_at?.slice(0,5)||''} onChange={e=>setHours(hours.map((item,i)=>i===index?{...item,closes_at:e.target.value}:item))}/></label>)}</div><Button onClick={save}>Save weekly hours</Button><form className="admin-inline-form" onSubmit={block}><input type="date" name="startsOn" required/><input type="date" name="endsOn" required/><input name="reason" placeholder="Closure reason"/><Button>Add closure</Button></form><div className="admin-list">{blocked.map(row=><article key={row.id}><span>{row.starts_on} – {row.ends_on} · {row.reason}</span><Button onClick={async()=>{await api(`/api/admin/schedule?id=${row.id}`,{method:'DELETE'});load()}}>Remove</Button></article>)}</div></Module>}

export function GalleryModule(){const r=useResource('/api/admin/gallery','images'),upload=async(event)=>{event.preventDefault();await api('/api/admin/gallery',{method:'POST',body:new FormData(event.currentTarget)});event.currentTarget.reset();r.load()},src=row=>row.storage_path.startsWith('local/')?`/gallery/${row.storage_path.slice(6)}`:`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/salon-gallery/${row.storage_path}`;return <Module title="Gallery" intro="Upload, caption, publish and remove images."><form className="admin-inline-form" onSubmit={upload}><input type="file" name="file" accept="image/jpeg,image/png,image/webp" required/><input name="altText" placeholder="Accessible image description" required/><input name="caption" placeholder="Caption"/><Button>Upload</Button></form><State {...r}><div className="admin-gallery-list">{r.rows.map(row=><article key={row.id}><img src={src(row)} alt={row.alt_text}/><strong>{row.caption||row.alt_text}</strong><Button onClick={async()=>{if(confirm('Delete this image?')){await api(`/api/admin/gallery?id=${row.id}`,{method:'DELETE'});r.load()}}}>Delete</Button></article>)}</div></State></Module>}

export function SiteContentModule(){const [data,setData]=useState(null),[message,setMessage]=useState('');useEffect(()=>{api('/api/admin/site-content').then(row=>setData(row.content.data))},[]);if(!data)return <Module title="Site content"><p>Loading…</p></Module>;const contact=data.contact||{},identity=data.identity||{},field=(group,key,value)=>setData({...data,[group]:{...(data[group]||{}),[key]:value}});return <Module title="Site content" intro="Edit the public identity, homepage message and contact details."><form className="admin-content-form" onSubmit={async e=>{e.preventDefault();await api('/api/admin/site-content',{method:'PATCH',body:JSON.stringify({data})});setMessage('Saved and published.')}}><label>Salon name<input value={identity.name||''} onChange={e=>field('identity','name',e.target.value)}/></label><label>Hero title<input value={identity.heroTitle||''} onChange={e=>field('identity','heroTitle',e.target.value)}/></label><label>Hero description<input value={identity.heroBody||''} onChange={e=>field('identity','heroBody',e.target.value)}/></label><label>WhatsApp<input value={contact.whatsapp||''} onChange={e=>field('contact','whatsapp',e.target.value)}/></label><label>Email<input value={contact.email||''} onChange={e=>field('contact','email',e.target.value)}/></label><label>Instagram<input value={contact.instagram||''} onChange={e=>field('contact','instagram',e.target.value)}/></label><label>Area<input value={contact.area||''} onChange={e=>field('contact','area',e.target.value)}/></label><label>Address note<input value={contact.addressNote||''} onChange={e=>field('contact','addressNote',e.target.value)}/></label><label>Booking message<input value={data.bookingNotice||''} onChange={e=>setData({...data,bookingNotice:e.target.value})}/></label><Button>Save content</Button>{message?<span>{message}</span>:null}</form></Module>}

export function AdministratorsModule(){const r=useResource('/api/admin/administrators','administrators'),add=async(event)=>{event.preventDefault();const email=new FormData(event.currentTarget).get('email');await api('/api/admin/administrators',{method:'POST',body:JSON.stringify({email})});event.currentTarget.reset();r.load()};return <Module title="Administrators" intro="Invite administrators and revoke access. The final active administrator is protected."><form className="admin-inline-form" onSubmit={add}><input type="email" name="email" placeholder="admin@example.com" required/><Button>Invite administrator</Button></form><State {...r}><div className="admin-list">{r.rows.map(row=><article key={row.user_id}><div><strong>{row.email||row.user_id}</strong><p>{row.is_active?'Active':'Inactive'}</p></div><Button onClick={async()=>{await api('/api/admin/administrators',{method:'PATCH',body:JSON.stringify({userId:row.user_id,isActive:!row.is_active})});r.load()}}>{row.is_active?'Revoke':'Restore'}</Button></article>)}</div></State></Module>}

function Module({title,intro,children}){return <div className="admin-module"><header><h2>{title}</h2>{intro?<p>{intro}</p>:null}</header>{children}</div>}

export function SettingsModule(){
  // Runtime settings: notification toggles + booking rules.
  const [settings,setSettings]=useState(null),[settingsMsg,setSettingsMsg]=useState(''),[settingsErr,setSettingsErr]=useState('')
  const loadSettings=async()=>{try{setSettingsErr('');const data=await api('/api/admin/settings');setSettings(data.settings)}catch(e){setSettingsErr(e.message)}}
  useEffect(()=>{loadSettings()},[])
  const updateSetting=(key,value)=>setSettings(prev=>({...prev,[key]:value}))
  const saveSettings=async()=>{try{setSettingsMsg('');setSettingsErr('');const data=await api('/api/admin/settings',{method:'PATCH',body:JSON.stringify({settings})});setSettings(data.settings);setSettingsMsg('✓ 已儲存設定');setTimeout(()=>setSettingsMsg(''),3000)}catch(e){setSettingsErr(e.message)}};

  // Weekly hours + closed dates (delegates to the existing schedule API).
  const [hours,setHours]=useState([]),[blocked,setBlocked]=useState([]),[scheduleErr,setScheduleErr]=useState(''),[scheduleMsg,setScheduleMsg]=useState('')
  const loadSchedule=async()=>{try{setScheduleErr('');const data=await api('/api/admin/schedule');setHours(data.hours);setBlocked(data.blockedDates)}catch(e){setScheduleErr(e.message)}}
  useEffect(()=>{loadSchedule()},[])
  const saveHours=async()=>{try{setScheduleErr('');setScheduleMsg('');await api('/api/admin/schedule',{method:'POST',body:JSON.stringify({type:'hours',hours})});setScheduleMsg('✓ 已儲存營業時間');setTimeout(()=>setScheduleMsg(''),3000);loadSchedule()}catch(e){setScheduleErr(e.message)}}
  const addBlock=async(event)=>{event.preventDefault();try{setScheduleErr('');const data=Object.fromEntries(new FormData(event.currentTarget));await api('/api/admin/schedule',{method:'POST',body:JSON.stringify(data)});event.currentTarget.reset();loadSchedule()}catch(e){setScheduleErr(e.message)}}
  const removeBlock=async(id)=>{try{await api(`/api/admin/schedule?id=${id}`,{method:'DELETE'});loadSchedule()}catch(e){setScheduleErr(e.message)}}
  const weekdayLabel=['日','一','二','三','四','五','六']

  if(!settings) return <Module title="設定"><p>Loading…</p></Module>

  return (
    <div style={{display:'flex',flexDirection:'column',gap:24}}>
      <Module title="通知偏好" intro="選擇客人會收到邊啲渠道嘅訊息。Email 會去 Resend，WhatsApp 仲係 stub。">
        {settingsErr?<p className="salon-error">{settingsErr}</p>:null}
        {settingsMsg?<p style={{color:'#2c6e3a'}}>{settingsMsg}</p>:null}
        <div className="admin-list" style={{marginBottom:16}}>
          <label className="admin-toggle-row"><span><strong>Email 通知</strong><small style={{display:'block',color:'#706961',fontSize:12}}>預約確認、取消、改期同 24 小時提醒</small></span><input type="checkbox" checked={Boolean(settings.notify_email_enabled)} onChange={e=>updateSetting('notify_email_enabled',e.target.checked)}/></label>
          <label className="admin-toggle-row"><span><strong>WhatsApp 通知</strong><small style={{display:'block',color:'#706961',fontSize:12}}>需要先喺 Vercel set TWILIO 認證</small></span><input type="checkbox" checked={Boolean(settings.notify_whatsapp_enabled)} onChange={e=>updateSetting('notify_whatsapp_enabled',e.target.checked)} disabled/></label>
          <label className="admin-toggle-row"><span><strong>Console log</strong><small style={{display:'block',color:'#706961',fontSize:12}}>server console 打印訊息內容，方便除錯</small></span><input type="checkbox" checked={Boolean(settings.notify_console_enabled)} onChange={e=>updateSetting('notify_console_enabled',e.target.checked)}/></label>
          <label className="admin-toggle-row"><span><strong>Dry-run 模式</strong><small style={{display:'block',color:'#706961',fontSize:12}}>暫停真實發送，所有渠道都只係 log</small></span><input type="checkbox" checked={Boolean(settings.notify_dry_run)} onChange={e=>updateSetting('notify_dry_run',e.target.checked)}/></label>
        </div>
        <Module title="預約規則" intro="控制取消期限、提前提醒同預約 buffer。">
          <div className="admin-inline-form" style={{alignItems:'flex-end'}}>
            <label>取消期限（小時）<input type="number" min="0" max="168" value={settings.cancel_cutoff_hours} onChange={e=>updateSetting('cancel_cutoff_hours',Number(e.target.value))}/></label>
            <label>提醒提前（小時）<input type="number" min="1" max="168" value={settings.reminder_hours_before} onChange={e=>updateSetting('reminder_hours_before',Number(e.target.value))}/></label>
            <label>預約 buffer（分鐘）<input type="number" min="0" max="120" value={settings.booking_buffer_minutes} onChange={e=>updateSetting('booking_buffer_minutes',Number(e.target.value))}/></label>
            <Button onClick={saveSettings}>儲存所有設定</Button>
          </div>
        </Module>
      </Module>

      <Module title="營業時間" intro="每週開放時間同特別休息日。改完記得按儲存。">
        {scheduleErr?<p className="salon-error">{scheduleErr}</p>:null}
        {scheduleMsg?<p style={{color:'#2c6e3a'}}>{scheduleMsg}</p>:null}
        <div className="hours-grid">{hours.map((row,index)=><label key={row.weekday}><span>{'星期'+weekdayLabel[row.weekday]}</span><input type="checkbox" checked={row.is_open} onChange={e=>setHours(hours.map((item,i)=>i===index?{...item,is_open:e.target.checked}:item))}/><input type="time" disabled={!row.is_open} value={row.opens_at?.slice(0,5)||''} onChange={e=>setHours(hours.map((item,i)=>i===index?{...item,opens_at:e.target.value}:item))}/><input type="time" disabled={!row.is_open} value={row.closes_at?.slice(0,5)||''} onChange={e=>setHours(hours.map((item,i)=>i===index?{...item,closes_at:e.target.value}:item))}/></label>)}</div>
        <div style={{marginTop:12}}><Button onClick={saveHours}>儲存每週時間</Button></div>
        <form className="admin-inline-form" onSubmit={addBlock} style={{marginTop:20}}>
          <input type="date" name="startsOn" required/>
          <input type="date" name="endsOn" required/>
          <input name="reason" placeholder="休息原因（例：農曆新年）"/>
          <Button>加休息日</Button>
        </form>
        <div className="admin-list" style={{marginTop:12}}>{blocked.map(row=><article key={row.id}><span>{row.starts_on} – {row.ends_on} · {row.reason||'—'}</span><Button onClick={()=>removeBlock(row.id)}>移除</Button></article>)}</div>
      </Module>
    </div>
  )
}

export function AuditLogModule(){
  const r = useResource('/api/admin/audit-logs', 'auditLogs')
  const [actionFilter, setActionFilter] = useState('')
  const load = () => { r.load() }
  useEffect(() => { /* re-fetch when filter changes */ load() }, [actionFilter])
  return (
    <Module title="審計日誌" intro="所有 admin 寫入動作的追加日誌。用作合規審查同除錯。">
      <div className="admin-inline-form" style={{ marginBottom: 16 }}>
        <input
          placeholder="按 action 過濾（例如 customer_package.create）"
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
        />
        <Button onClick={load}>重新載入</Button>
      </div>
      <State {...r}>
        <div className="admin-list">
          {r.rows
            .filter(row => !actionFilter || row.action === actionFilter)
            .map(row => (
              <article key={row.id}>
                <div>
                  <strong>{row.action}</strong>
                  {row.target_table && <span style={{ marginLeft: 8, color: '#706961', fontSize: 13 }}>on {row.target_table}#{row.target_id}</span>}
                  <p style={{ fontSize: 12, color: '#928a81' }}>
                    {new Date(row.created_at).toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong', dateStyle: 'long', timeStyle: 'medium' })}
                    {row.actor_user_id && ` · actor ${row.actor_user_id.slice(0, 8)}…`}
                    {row.ip && ` · ${row.ip}`}
                  </p>
                </div>
              </article>
            ))}
        </div>
      </State>
    </Module>
  )
}
