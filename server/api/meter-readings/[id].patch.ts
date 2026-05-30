import { MeterReadingService } from '../../services/meter-readings'
import { meterReadingUpdateSchema } from '~/utils/validators/meter-readings'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const id = getRouterParam(event, 'id') as string
  const body = await readBody(event)
  const result = meterReadingUpdateSchema.safeParse(body)
  if (!result.success) {
    throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())
  }

  const reading = await MeterReadingService.update(event, user, id, result.data)
  return { data: reading }
})
