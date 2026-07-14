import type { H3Event } from 'h3'
import type { AiActionPlanDto, AiBuildingSummary } from '~/types/ai'
import type { AuthUser } from '~/types/auth'
import type { BillingPeriod } from '~/types/billing'
import { toAiActionPlanDto } from '~/utils/mappers/ai'
import type { AiToolPlanOpenBillingPeriodInput } from '~/utils/validators/ai'
import { BillingPeriodRepository } from '../../repositories/billing/periods'
import { can } from '../../utils/permissions'
import { AiActionService } from './actions'
import { AiBuildingService } from './buildings'

export type AiOpenBillingPeriodPlanResult =
  | { status: 'planned'; actionPlan: AiActionPlanDto }
  | { status: 'already_exists'; building: AiBuildingSummary; period: BillingPeriod }
  | { status: 'needs_clarification'; candidates: AiBuildingSummary[] }
  | { status: 'not_found' }

export const AiBillingPeriodPlanner = {
  async planOpen(
    event: H3Event,
    user: AuthUser,
    conversationId: string,
    input: AiToolPlanOpenBillingPeriodInput,
  ): Promise<AiOpenBillingPeriodPlanResult> {
    if (!can(user, 'billing.write')) throwForbidden('Không có quyền tạo kỳ vận hành')
    const resolution = await AiBuildingService.resolve(event, user, input.building_ref)
    if (resolution.status === 'not_found') return resolution
    if (resolution.status === 'ambiguous') {
      return { status: 'needs_clarification', candidates: resolution.candidates }
    }

    const building = resolution.building
    const existing = await BillingPeriodRepository.findByBuildingPeriod(
      event,
      building.id,
      input.period_year,
      input.period_month,
    )
    if (existing) return { status: 'already_exists', building, period: existing }

    const monthLabel = `${String(input.period_month).padStart(2, '0')}/${input.period_year}`
    const plan = await AiActionService.createPlan(event, user, {
      conversation_id: conversationId,
      building_id: building.id,
      action_type: 'open_billing_period',
      title: `Mở kỳ ${monthLabel}`,
      summary: `Tạo kỳ vận hành tháng ${monthLabel} cho ${building.name}.`,
      normalized_payload: {
        building_id: building.id,
        period_year: input.period_year,
        period_month: input.period_month,
      },
      preview: {
        building: { id: building.id, slug: building.slug, name: building.name },
        period_year: input.period_year,
        period_month: input.period_month,
        initial_status: 'draft',
      },
      warnings: [],
      resource_versions: { building: building.updatedAt },
      expires_in_seconds: 900,
    })
    return { status: 'planned', actionPlan: toAiActionPlanDto(plan) }
  },
}
