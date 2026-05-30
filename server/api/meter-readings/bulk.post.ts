import { MeterReadingService } from '../../services/meter-readings'
import { meterReadingBulkSchema } from '~/utils/validators/meter-readings'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const body = await readBody(event)
  const result = meterReadingBulkSchema.safeParse(body)
  if (!result.success) {
    throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())
  }

  const readings = await MeterReadingService.bulkCreate(event, user, result.data, user.id)
  setResponseStatus(event, 201)
  return { data: readings, meta: { count: readings.length } }
})
