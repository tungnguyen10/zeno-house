import { BillingRunService } from '../../services/billing-runs'
import { billingGenerateSchema } from '~/utils/validators/billing'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const body = await readBody(event)

  const result = billingGenerateSchema.safeParse(body)
  if (!result.success) {
    throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())
  }

  const { building_id, year, month } = result.data

  try {
    const run = await BillingRunService.generateSnapshot(event, user, building_id, year, month)
    setResponseStatus(event, 201)
    return { data: run }
  }
  catch (e: unknown) {
    if (e && typeof e === 'object' && 'statusCode' in e) throw e
    const message = e instanceof Error ? e.message : 'Lỗi không xác định khi tạo hóa đơn'
    console.error('[billing-runs/generate]', e)
    throw createError({ statusCode: 500, data: { error: { code: 'INTERNAL_ERROR', message } } })
  }
})
