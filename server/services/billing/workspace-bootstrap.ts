import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { BillingWorkspaceBootstrap } from '~/types/billing'
import type { BillingPeriodOpenInput } from '~/utils/validators/billing'
import { BillingDraftService } from './drafts'
import { BillingDraftGridService } from './grid'
import { InvoiceService } from './invoices'
import { BillingPeriodService } from './periods'
import { BillingUtilityUsageService } from './utility-usages'

const COLLECTION_STATUSES = new Set(['issued', 'collecting', 'closed'])

export const BillingWorkspaceBootstrapService = {
  async get(
    event: H3Event,
    user: AuthUser,
    input: BillingPeriodOpenInput,
  ): Promise<BillingWorkspaceBootstrap> {
    const period = await BillingPeriodService.openOrGet(event, user, input)

    if (COLLECTION_STATUSES.has(period.status)) {
      const [overview, invoices, drafts] = await Promise.all([
        BillingPeriodService.getOverview(event, user, period.id),
        InvoiceService.list(event, user, period.id),
        BillingDraftService.calculateDraft(event, user, period.id),
      ])
      return {
        period,
        grid: null,
        utilityUsages: [],
        overview,
        invoices,
        drafts,
      }
    }

    const [grid, utilityUsages] = await Promise.all([
      BillingDraftGridService.getGrid(event, user, period.id),
      BillingUtilityUsageService.list(event, user, period.id),
    ])
    return {
      period,
      grid,
      utilityUsages,
      overview: null,
      invoices: [],
      drafts: null,
    }
  },
}
