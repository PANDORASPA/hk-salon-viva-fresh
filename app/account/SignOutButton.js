'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { getBrowserClient } from '../../lib/supabase/browser'
export default function SignOutButton(){const router=useRouter(),[busy,setBusy]=useState(false);return <button className="salon-button secondary" disabled={busy} onClick={async()=>{setBusy(true);await getBrowserClient().auth.signOut();router.push('/');router.refresh()}}>{busy?'Signing out…':'Sign out'}</button>}
