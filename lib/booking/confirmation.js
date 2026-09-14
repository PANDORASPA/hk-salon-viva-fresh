import { createHash } from 'node:crypto'

export const CONFIRMATION_APPOINTMENT_SELECT =
  'id,reference,starts_at,status,customer_name,services(name,price,duration_minutes),staff(display_name)'

function appointmentId(value) {
  if (!/^[1-9]\d*$/.test(String(value ?? ''))) return null
  const id = Number(value)
  return Number.isSafeInteger(id) ? id : null
}

export function confirmationTokenHash(token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null
  const decoded = Buffer.from(token, 'base64url')
  if (decoded.length !== 32 || decoded.toString('base64url') !== token) return null
  return createHash('sha256').update(token).digest('hex')
}

async function findOwnedAppointment(database, id, userId) {
  const { data, error } = await database.from('appointments')
    .select(CONFIRMATION_APPOINTMENT_SELECT)
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

async function findTokenAppointment(database, id, tokenHash) {
  const { data, error } = await database.from('appointments')
    .select(CONFIRMATION_APPOINTMENT_SELECT)
    .eq('id', id)
    .eq('confirmation_token_hash', tokenHash)
    .maybeSingle()
  if (error) throw error
  return data
}

async function resolveServiceDatabase(serviceDatabase) {
  return typeof serviceDatabase === 'function' ? serviceDatabase() : serviceDatabase
}

/**
 * Confirmation links are capabilities: the 256-bit token is compared only as
 * its server-side SHA-256 hash. An appointment number is never an authority.
 */
export async function loadConfirmationAppointment({ id: rawId, confirmationToken, user, serverDatabase, serviceDatabase }) {
  const id = appointmentId(rawId)
  if (!id) return null

  if (user?.id) {
    const owned = await findOwnedAppointment(serverDatabase, id, user.id)
    if (owned) return owned
  }

  const tokenHash = confirmationTokenHash(confirmationToken)
  if (!tokenHash) return null
  return findTokenAppointment(await resolveServiceDatabase(serviceDatabase), id, tokenHash)
}
