import type { H3Event } from 'h3'
import type { TenantContractSummary } from '~/types/tenant-portal'
import { mapTenantContractSummary } from '~/utils/mappers/tenant-portal'
import { db } from '../../utils/db'

export const TenantContractRepository = {
  async findActiveByTenantId(
    event: H3Event,
    tenantId: string,
    today: string,
  ): Promise<TenantContractSummary | null> {
    const { data, error } = await db(event)
      .from('contracts')
      .select('id, contract_code, start_date, end_date, monthly_rent, deposit, status, rooms!inner(room_number, buildings!inner(name))')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .lte('start_date', today)
      .gte('end_date', today)
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throwDbError(error, 'tenantPortal.contract.findActiveByTenantId')
    return data ? mapTenantContractSummary(data as never) : null
  },
}
