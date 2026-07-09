import { MeterReadingService } from '../../services/meter-readings'
import { meterReadingUpdateSchema } from '~/utils/validators/meter-readings'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const id = getRouterParam(event, 'id') as string
  const input = await parseBody(event, meterReadingUpdateSchema)

  const reading = await MeterReadingService.update(event, user, id, input)
  return { data: reading }
})
