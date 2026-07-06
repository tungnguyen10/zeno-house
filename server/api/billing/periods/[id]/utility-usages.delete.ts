import { BillingUtilityUsageService } from '../../../../services/billing/utility-usages'
import { z } from 'zod'

const schema = z.object({
  override_id: z.string().uuid(),
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throwValidationError('Thiếu mã kỳ vận hành')

  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throwValidationError('Dữ liệu không hợp lệ', parsed.error.flatten())
  }

  await BillingUtilityUsageService.deleteOverride(event, user, id!, parsed.data.override_id)

  return { data: null }
})
