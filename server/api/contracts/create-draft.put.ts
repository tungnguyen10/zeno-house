import { z } from 'zod'
import { contractCreateDraftSchema } from '~/utils/validators/contract-create-draft'
import { ContractCreateDraftService } from '../../services/contracts/create-draft'

const bodySchema = z.object({ payload: contractCreateDraftSchema })

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const body = await readBody(event)
  const result = bodySchema.safeParse(body)
  if (!result.success) throwValidationError('Bản nháp không hợp lệ', result.error.flatten())
  if (JSON.stringify(result.data.payload).length > 65536) {
    throw createError({ statusCode: 413, data: { error: { code: 'PAYLOAD_TOO_LARGE', message: 'Bản nháp quá lớn' } } })
  }
  return { data: await ContractCreateDraftService.save(event, user, result.data.payload) }
})
