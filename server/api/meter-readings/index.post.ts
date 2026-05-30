import { MeterReadingService } from '../../services/meter-readings'
import { meterReadingCreateSchema } from '~/utils/validators/meter-readings'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const body = await readBody(event)
  const result = meterReadingCreateSchema.safeParse(body)
  if (!result.success) {
    throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())
  }

  const reading = await MeterReadingService.create(event, user, result.data, user.id)
  setResponseStatus(event, 201)
  return { data: reading }
})
