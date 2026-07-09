import { MeterReadingService } from '../../services/meter-readings'
import { meterReadingBulkSchema } from '~/utils/validators/meter-readings'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const input = await parseBody(event, meterReadingBulkSchema)

  const readings = await MeterReadingService.bulkCreate(event, user, input, user.id)
  setResponseStatus(event, 201)
  return { data: readings, meta: { count: readings.length } }
})
