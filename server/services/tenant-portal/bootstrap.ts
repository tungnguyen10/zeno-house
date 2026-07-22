import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { TenantPortalBootstrap } from '~/types/tenant-portal'
import { TenantProfileService } from './profile'
import { TenantContractService } from './contract'
import { TenantInvoiceService } from './invoices'

function todayInHoChiMinh(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export const TenantBootstrapService = {
  async get(
    event: H3Event,
    user: AuthUser,
    today = todayInHoChiMinh(),
  ): Promise<TenantPortalBootstrap> {
    const [profile, contract, invoiceResult] = await Promise.all([
      TenantProfileService.get(event, user),
      TenantContractService.get(event, user, today),
      TenantInvoiceService.list(event, user, { page: 1, page_size: 20 }, today),
    ])

    return {
      profile,
      contract,
      invoices: invoiceResult.data,
      invoiceMeta: invoiceResult.meta,
    }
  },
}
