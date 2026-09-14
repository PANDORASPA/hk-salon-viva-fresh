import { rpcClient } from './booking-database.mjs'

// Supabase transport substitute only: all reads/writes run against the migrated
// PostgreSQL database. Ownership/filter mistakes affect real returned rows.
export function customerClient(db) {
  return { ...rpcClient(db), from(table) {
    const filters = []; let columns = '*'; let insertion; let conflict; let single = false
    const query = {
      select(value) { columns = value; return query },
      eq(key, value) { filters.push([key, '=', value]); return query },
      gt(key, value) { filters.push([key, '>', value]); return query },
      upsert(value, options) { insertion = value; conflict = options; return query },
      maybeSingle() { single = true; return query },
      order() { return query },
      async then(resolve, reject) {
        try {
          let result
          if (insertion) {
            const keys = Object.keys(insertion)
            assertIdentifier(conflict.onConflict)
            if (!conflict.ignoreDuplicates) throw new Error('Test transport requires conflict-ignore semantics')
            result = await db.query(`insert into public.${assertIdentifier(table)} (${keys.map(assertIdentifier)}) values (${keys.map((_,i) => '$'+(i+1))}) on conflict (${conflict.onConflict}) do nothing returning *`, Object.values(insertion))
          } else {
            // Expand the one nested relation used by the real package endpoint.
            let projection = columns.replace(/packages\(([^)]+),package_services\(service_id\)\)/g, (_, fields) => `(select json_build_object(${fields.split(',').map(field => `'${field.trim()}',p.${assertIdentifier(field.trim())}`).join(',')},'package_services',(select coalesce(jsonb_agg(jsonb_build_object('service_id',ps.service_id)),'[]') from public.package_services ps where ps.package_id=p.id)) from public.packages p where p.id=t.package_id) as packages`)
            if (projection === columns) projection = columns.replace(/packages\(([^)]+)\)/g, (_, fields) => `(select json_build_object(${fields.split(',').map(field => `'${field.trim()}',p.${assertIdentifier(field.trim())}`).join(',')}) from public.packages p where p.id=t.package_id) as packages`)
            const where = filters.map(([key, op],i) => `t.${assertIdentifier(key)} ${op} $${i+1}`).join(' and ')
            result = await db.query(`select ${projection} from public.${assertIdentifier(table)} t${where ? ' where '+where : ''}`, filters.map(([, , value]) => value))
          }
          const data = JSON.parse(JSON.stringify(single ? result.rows[0] || null : result.rows))
          resolve({ data, error: null })
        } catch (error) { resolve({ data: null, error }) }
      },
    }
    return query
  } }
}

function assertIdentifier(value) {
  if (!/^[a-z_]+$/.test(value)) throw new Error('Invalid SQL identifier in test transport')
  return value
}

export function authClient(user, error = null) {
  return { auth: { getUser: async () => ({ data: { user }, error }) } }
}
