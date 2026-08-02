import type { H3Event } from 'h3'
import type { AiConversation, AiMessage, AiMessageRole } from '~/types/ai'
import type { Json } from '~/types/database.types'
import { mapAiConversation, mapAiMessage, type AiConversationRow, type AiMessageRow } from '~/utils/mappers/ai'
import { db } from '../../utils/db'

export const AiConversationRepository = {
  async beginTurn(event: H3Event, input: {
    userId: string
    conversationId?: string
    content: string
    historyLimit: number
    expiresAt: string
  }): Promise<{ conversation: AiConversation; userMessage: AiMessage; messages: AiMessage[] } | null> {
    const client = db(event)
    const rpc = client.rpc.bind(client) as unknown as (name: string, args: Record<string, unknown>) => Promise<{
      data: unknown
      error: { message: string } | null
    }>
    const { data, error } = await rpc('begin_ai_chat_turn', {
      p_user_id: input.userId,
      p_conversation_id: input.conversationId ?? null,
      p_content: input.content,
      p_history_limit: input.historyLimit,
      p_expires_at: input.expiresAt,
    })
    if (error) throwDbError(error, 'ai.conversations.beginTurn')
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null
    const result = data as { conversation?: unknown; user_message?: unknown; messages?: unknown }
    if (!result.conversation || !result.user_message || !Array.isArray(result.messages)) {
      throwInternal(new Error('Invalid AI chat turn result'), 'ai.conversations.beginTurn')
    }
    return {
      conversation: mapAiConversation(result.conversation as AiConversationRow),
      userMessage: mapAiMessage(result.user_message as AiMessageRow),
      messages: result.messages.map(row => mapAiMessage(row as AiMessageRow)),
    }
  },

  async cleanupExpired(event: H3Event, limit: number): Promise<number> {
    const client = db(event)
    const { data, error } = await client.rpc('cleanup_expired_ai_conversations', { p_limit: limit })
    if (error) throwDbError(error, 'ai.conversations.cleanupExpired')
    return Number(data ?? 0)
  },

  async create(event: H3Event, userId: string): Promise<AiConversation> {
    const { data, error } = await db(event).from('ai_conversations')
      .insert({ user_id: userId, status: 'active', title: null, expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString() })
      .select()
      .single()
    if (error) throwDbError(error, 'ai.conversations.create')
    return mapAiConversation(data)
  },

  async findOwnedById(event: H3Event, id: string, userId: string): Promise<AiConversation | null> {
    const { data, error } = await db(event).from('ai_conversations')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throwDbError(error, 'ai.conversations.findOwnedById')
    return data ? mapAiConversation(data) : null
  },

  async touch(event: H3Event, id: string, userId: string): Promise<void> {
    const { error } = await db(event).from('ai_conversations')
      .update({ expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
    if (error) throwDbError(error, 'ai.conversations.touch')
  },

  async appendMessage(
    event: H3Event,
    input: { conversationId: string; userId: string; role: AiMessageRole; content: string; metadata?: Record<string, unknown> },
  ): Promise<AiMessage> {
    const { data, error } = await db(event).from('ai_messages')
      .insert({
        conversation_id: input.conversationId,
        user_id: input.userId,
        role: input.role,
        content: input.content,
        metadata: (input.metadata ?? {}) as Json,
      })
      .select()
      .single()
    if (error) throwDbError(error, 'ai.messages.append')
    return mapAiMessage(data)
  },

  async findOwnedUserMessage(
    event: H3Event,
    messageId: string,
    conversationId: string,
    userId: string,
  ): Promise<AiMessage | null> {
    const { data, error } = await db(event).from('ai_messages')
      .select('*')
      .eq('id', messageId)
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .eq('role', 'user')
      .maybeSingle()
    if (error) throwDbError(error, 'ai.messages.findOwnedUserMessage')
    return data ? mapAiMessage(data) : null
  },

  async listMessages(event: H3Event, conversationId: string, userId: string): Promise<AiMessage[]> {
    const { data, error } = await db(event).from('ai_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(100)
    if (error) throwDbError(error, 'ai.messages.list')
    return (data ?? []).map(mapAiMessage)
  },
}
