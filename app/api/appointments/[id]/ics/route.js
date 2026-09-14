import { getServerClient } from '../../../../../lib/supabase/server.js'
import { getServiceClient } from '../../../../../lib/supabase/service.js'
import { createIcsHandler } from '../../../../../lib/booking/confirmation-ics.js'

export { createIcsHandler }

export async function GET(request, context) {
  return createIcsHandler({ getServerClient, getServiceClient })(request, context)
}
