import type { H3Event } from 'h3'
import { db } from '../../utils/db'

export async function getTenantIdForAuthUser(
  event: H3Event,
  authUserId: string,
): Promise<string | null> {
  const { data, error } = await db(event)
    .from('tenant_user_links')
    .select('tenant_id')
    .eq('auth_user_id', authUserId)
    .eq('status', 'active')
    .maybeSingle()

  if (error) throwDbError(error, 'tenantPortal.links.getTenantIdForAuthUser')
  return data?.tenant_id ?? null
}
