import { toAiActionPlanDto } from '~/utils/mappers/ai'
import { aiActionIdSchema } from '~/utils/validators/ai'
import { AiActionService } from '../../../../services/ai/actions'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const parsed = aiActionIdSchema.safeParse(getRouterParam(event, 'id'))
  if (!parsed.success) throwValidationError('Mã kế hoạch thao tác không hợp lệ')
  const result = await AiActionService.confirm(event, user, parsed.data)
  const domainResult = result.plan.result && typeof result.plan.result === 'object'
    ? result.plan.result as Record<string, unknown>
    : null
  return {
    data: toAiActionPlanDto(result.plan),
    meta: { replayed: result.replayed || domainResult?.replayed === true },
  }
})
