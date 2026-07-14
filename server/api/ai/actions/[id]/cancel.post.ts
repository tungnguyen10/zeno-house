import { toAiActionPlanDto } from '~/utils/mappers/ai'
import { aiActionIdSchema } from '~/utils/validators/ai'
import { AiActionService } from '../../../../services/ai/actions'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const parsed = aiActionIdSchema.safeParse(getRouterParam(event, 'id'))
  if (!parsed.success) throwValidationError('Mã kế hoạch thao tác không hợp lệ')
  const plan = await AiActionService.cancel(event, user, parsed.data)
  return { data: toAiActionPlanDto(plan) }
})
