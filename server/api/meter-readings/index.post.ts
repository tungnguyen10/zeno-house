import { MeterReadingService } from '../../services/meter-readings'
import { meterReadingCreateSchema } from '~/utils/validators/meter-readings'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const input = await parseBody(event, meterReadingCreateSchema)

  const reading = await MeterReadingService.create(event, user, input, user.id)
  setResponseStatus(event, 201)
  return { data: reading }
})
