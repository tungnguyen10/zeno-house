import { BillingRunService } from '../../services/billing-runs'
import { billingPreviewSchema } from '~/utils/validators/billing'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const body = await readBody(event)

  const result = billingPreviewSchema.safeParse(body)
  if (!result.success) {
    throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())
  }

  const { building_id, year, month } = result.data
  const preview = await BillingRunService.previewBilling(event, user, building_id, year, month)

  return { data: preview }
})
