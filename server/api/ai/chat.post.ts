import { aiChatRequestSchema } from '~/utils/validators/ai'
import { streamAiChat } from '../../services/ai/chat'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const input = await parseBody(event, aiChatRequestSchema)
  const response = await streamAiChat(event, user, input)

  return sendWebResponse(event, response)
})
