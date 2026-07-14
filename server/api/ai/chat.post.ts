import { aiChatRequestSchema } from '~/utils/validators/ai'
import { streamAiChat } from '../../services/ai/chat'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const input = await parseBody(event, aiChatRequestSchema)
  const id = input.id ?? crypto.randomUUID()

  const messages = input.messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
  const response = await streamAiChat(event, user, { id, messages })

  return sendWebResponse(event, response)
})