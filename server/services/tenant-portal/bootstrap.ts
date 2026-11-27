import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { TenantPortalBootstrap } from '~/types/tenant-portal'
import { TenantProfileService } from './profile'
import { TenantContractService } from './contract'
import { TenantInvoiceService } from './invoices'
import { vietnamDateISO } from '../../utils/date'

export const TenantBootstrapService = {
  async get(
    event: H3Event,
    user: AuthUser,
    today = vietnamDateISO(),
  ): Promise<TenantPortalBootstrap> {
    const [profile, contract, contractAmendments, invoiceResult, financialSummary] = await Promise.all([
      TenantProfileService.get(event, user),
      TenantContractService.get(event, user, today),
      TenantContractService.listAmendments(event, user, today),
      TenantInvoiceService.list(event, user, { page: 1, page_size: 20 }, today),
      TenantInvoiceService.getFinancialSummary(event, user, today),
    ])

    return {
      profile,
      contract,
      contractAmendments,
      invoices: invoiceResult.data,
      invoiceMeta: invoiceResult.meta,
      financialSummary,
    }
  },
}
