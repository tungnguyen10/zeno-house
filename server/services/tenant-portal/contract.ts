import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { TenantContractSummary } from '~/types/tenant-portal'
import { TenantHousingRepository } from '../../repositories/tenant-portal/housing'
import { resolveTenantId } from '../../utils/scope'
import { can } from '../../utils/permissions'
import { throwForbidden } from '../../utils/errors'

function todayInHoChiMinh(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export const TenantContractService = {
  async get(
    event: H3Event,
    user: AuthUser,
    today = todayInHoChiMinh(),
  ): Promise<TenantContractSummary | null> {
    if (!can(user, 'tenant.contract.read')) throwForbidden('Không có quyền xem hợp đồng')
    const id = await resolveTenantId(event, user)
    const context = await TenantHousingRepository.resolveActive(event, id, today)
    return context?.contract ?? null
  },
}
