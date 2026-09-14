'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
export default function ProfileForm({initialProfile,locale='zh-HK'}) {
  const router=useRouter(),lock=useRef(false)
  const [form,setForm]=useState({name:initialProfile?.name||'',phone:initialProfile?.phone||'',email:initialProfile?.email||''})
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false)
  const submit=async event=>{
    event.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError('');setSaved(false)
    try {
      const response=await fetch('/api/customers/me',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)})
      const data=await response.json();if(!response.ok)throw new Error(data.error||'未能儲存。')
      setSaved(true);router.refresh()
    } catch(cause){setError(cause.message)} finally{lock.current=false;setBusy(false)}
  }
  return <form onSubmit={submit}><fieldset disabled={busy}><legend>預約聯絡資料</legend>
    <label htmlFor="profile-name">{locale==='en'?'Name':'姓名'}<input id="profile-name" autoComplete="name" required minLength={2} maxLength={120} value={form.name} onChange={e=>{setSaved(false);setForm({...form,name:e.target.value})}}/></label>
    <label htmlFor="profile-phone">{locale==='en'?'Phone':'電話'}<input id="profile-phone" type="tel" autoComplete="tel" maxLength={30} value={form.phone} onChange={e=>{setSaved(false);setForm({...form,phone:e.target.value})}}/></label>
    <label htmlFor="profile-email">{locale==='en'?'Contact email':'聯絡電郵'}<input id="profile-email" type="email" autoComplete="email" maxLength={254} value={form.email} onChange={e=>{setSaved(false);setForm({...form,email:e.target.value})}}/></label>
    <p>這些資料用於預約聯絡；登入電郵維持帳戶原有設定。</p><button className="salon-button">{busy?'儲存中…':'儲存資料'}</button>
    </fieldset>{error?<p role="alert" className="salon-error">{error}</p>:null}{saved?<p role="status">已儲存聯絡資料。</p>:null}</form>
}
