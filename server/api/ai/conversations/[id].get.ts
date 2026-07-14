import { aiActionIdSchema } from '~/utils/validators/ai'
import { AiConversationService } from '../../../services/ai/conversations'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const parsed = aiActionIdSchema.safeParse(getRouterParam(event, 'id'))
  if (!parsed.success) throwValidationError('Mã hội thoại không hợp lệ')
  return { data: await AiConversationService.getTranscript(event, user, parsed.data) }
})
