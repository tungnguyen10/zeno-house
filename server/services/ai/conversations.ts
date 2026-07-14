import type { H3Event } from 'h3'
import type { AiConversation, AiConversationTranscript, AiMessage } from '~/types/ai'
import { toAiActionPlanDto } from '~/utils/mappers/ai'
import type { AuthUser } from '~/types/auth'
import { AiActionPlanRepository } from '../../repositories/ai/actions'
import { AiConversationRepository } from '../../repositories/ai/conversations'

function isExpired(expiresAt: string): boolean {
  return Date.parse(expiresAt) <= Date.now()
}

export const AiConversationService = {
  async resolve(event: H3Event, user: AuthUser, id?: string): Promise<AiConversation> {
    if (!id) return AiConversationRepository.create(event, user.id)

    const conversation = await AiConversationRepository.findOwnedById(event, id, user.id)
    if (!conversation || conversation.status !== 'active' || isExpired(conversation.expiresAt)) {
      throwNotFound('Không tìm thấy hội thoại AI đang hoạt động')
    }
    return conversation
  },

  async appendUserMessage(
    event: H3Event,
    user: AuthUser,
    conversation: AiConversation,
    content: string,
  ): Promise<AiMessage> {
    const message = await AiConversationRepository.appendMessage(event, {
      conversationId: conversation.id,
      userId: user.id,
      role: 'user',
      content,
    })
    await AiConversationRepository.touch(event, conversation.id, user.id)
    return message
  },

  async appendAssistantMessage(
    event: H3Event,
    user: AuthUser,
    conversationId: string,
    content: string,
    metadata: Record<string, unknown> = {},
  ): Promise<AiMessage | null> {
    if (!content.trim()) return null
    const message = await AiConversationRepository.appendMessage(event, {
      conversationId,
      userId: user.id,
      role: 'assistant',
      content: content.slice(0, 8000),
      metadata,
    })
    await AiConversationRepository.touch(event, conversationId, user.id)
    return message
  },

  async listMessages(event: H3Event, user: AuthUser, conversationId: string): Promise<AiMessage[]> {
    const conversation = await this.resolve(event, user, conversationId)
    return AiConversationRepository.listMessages(event, conversation.id, user.id)
  },

  async getOwnedUserMessage(
    event: H3Event,
    user: AuthUser,
    conversationId: string,
    messageId: string,
  ): Promise<AiMessage> {
    const conversation = await this.resolve(event, user, conversationId)
    const message = await AiConversationRepository.findOwnedUserMessage(
      event, messageId, conversation.id, user.id,
    )
    if (!message) throwNotFound('Không tìm thấy tin nhắn AI')
    return message
  },

  async getTranscript(event: H3Event, user: AuthUser, conversationId: string): Promise<AiConversationTranscript> {
    const conversation = await this.resolve(event, user, conversationId)
    const [messages, actionPlans] = await Promise.all([
      AiConversationRepository.listMessages(event, conversation.id, user.id),
      AiActionPlanRepository.listByConversation(event, conversation.id, user.id),
    ])
    return { conversation, messages, actionPlans: actionPlans.map(toAiActionPlanDto) }
  },
}
