import { BillingUtilityUsageService } from '../../../../services/billing/utility-usages'
import { z } from 'zod'

const schema = z.object({
  override_id: z.string().uuid(),
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throwValidationError('Thiếu mã kỳ vận hành')

  const input = await parseBody(event, schema)

  await BillingUtilityUsageService.deleteOverride(event, user, id!, input.override_id)

  return { data: null }
})
