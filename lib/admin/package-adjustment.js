export async function applyPackageAdjustment(db, actorId, input) {
  const id = Number(input?.id); const adjustment = Number(input?.adjustment); const reason = String(input?.reason || '').trim()
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('套票資料無效。')
  if (!Number.isSafeInteger(adjustment) || adjustment === 0) throw new Error('調整次數必須為非零整數。')
  if (!reason || reason.length > 500) throw new Error('請填寫調整原因。')
  const { data, error } = await db.rpc('admin_adjust_customer_package', {
    p_actor_id: actorId, p_customer_package_id: id, p_delta: adjustment, p_reason: reason,
  })
  if (error) throw error
  return data
}
