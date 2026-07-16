import type { H3Event } from 'h3'
import type { TenantProfile } from '~/types/tenant-portal'
import type { TenantProfileUpdateInput } from '~/utils/validators/tenant-portal'
import { mapTenantProfile } from '~/utils/mappers/tenant-portal'
import { db } from '../../utils/db'

const PROFILE_SELECT = 'id, code, full_name, phone, email, emergency_contact_name, emergency_contact_phone, notes'

export const TenantProfileRepository = {
  async findByTenantId(event: H3Event, tenantId: string): Promise<TenantProfile | null> {
    const { data, error } = await db(event)
      .from('tenants')
      .select(PROFILE_SELECT)
      .eq('id', tenantId)
      .maybeSingle()
    if (error) throwDbError(error, 'tenantPortal.profile.findByTenantId')
    return data ? mapTenantProfile(data) : null
  },

  async updateByTenantId(
    event: H3Event,
    tenantId: string,
    input: TenantProfileUpdateInput,
  ): Promise<TenantProfile> {
    const { data, error } = await db(event)
      .from('tenants')
      .update(input)
      .eq('id', tenantId)
      .select(PROFILE_SELECT)
      .single()
    if (error) throwDbError(error, 'tenantPortal.profile.updateByTenantId')
    return mapTenantProfile(data)
  },
}
