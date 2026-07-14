import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiConversation } from '~/types/ai'
import type { AuthUser } from '~/types/auth'
import { AiConversationService } from '../../../server/services/ai/conversations'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findOwnedById: vi.fn(),
  appendMessage: vi.fn(),
  touch: vi.fn(),
  listMessages: vi.fn(),
  findOwnedUserMessage: vi.fn(),
  listActions: vi.fn(),
}))

vi.mock('../../../server/repositories/ai/conversations', () => ({
  AiConversationRepository: {
    create: mocks.create,
    findOwnedById: mocks.findOwnedById,
    appendMessage: mocks.appendMessage,
    touch: mocks.touch,
    listMessages: mocks.listMessages,
    findOwnedUserMessage: mocks.findOwnedUserMessage,
  },
}))
vi.mock('../../../server/repositories/ai/actions', () => ({
  AiActionPlanRepository: { listByConversation: mocks.listActions },
}))

const event = {} as never
const actor = { id: 'user-1', app_metadata: { role: 'owner' } } as AuthUser

function conversation(overrides: Partial<AiConversation> = {}): AiConversation {
  return {
    id: 'conversation-1',
    userId: actor.id,
    status: 'active',
    title: null,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('AiConversationService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates server-owned state when no conversation id is supplied', async () => {
    const created = conversation()
    mocks.create.mockResolvedValue(created)
    await expect(AiConversationService.resolve(event, actor)).resolves.toEqual(created)
    expect(mocks.create).toHaveBeenCalledWith(event, actor.id)
  })

  it('hides foreign and expired conversations as not found', async () => {
    mocks.findOwnedById.mockResolvedValueOnce(null).mockResolvedValueOnce(
      conversation({ expiresAt: new Date(Date.now() - 1_000).toISOString() }),
    )
    await expect(AiConversationService.resolve(event, actor, 'foreign')).rejects.toMatchObject({ statusCode: 404 })
    await expect(AiConversationService.resolve(event, actor, 'expired')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('loads authoritative messages only after resolving ownership and expiry', async () => {
    const owned = conversation()
    const messages = [{ id: 'message-1', role: 'user', content: 'Hello' }]
    mocks.findOwnedById.mockResolvedValue(owned)
    mocks.listMessages.mockResolvedValue(messages)

    await expect(AiConversationService.listMessages(event, actor, owned.id)).resolves.toEqual(messages)
    expect(mocks.findOwnedById).toHaveBeenCalledWith(event, owned.id, actor.id)
    expect(mocks.listMessages).toHaveBeenCalledWith(event, owned.id, actor.id)
  })

  it('reloads only an owned user message from the active conversation', async () => {
    const owned = conversation()
    const message = { id: 'message-1', conversationId: owned.id, userId: actor.id, role: 'user', content: 'room,electricity\n101,10' }
    mocks.findOwnedById.mockResolvedValue(owned)
    mocks.findOwnedUserMessage.mockResolvedValue(message)

    await expect(AiConversationService.getOwnedUserMessage(event, actor, owned.id, message.id)).resolves.toEqual(message)
    expect(mocks.findOwnedUserMessage).toHaveBeenCalledWith(event, message.id, owned.id, actor.id)
  })

  it('hides a foreign stored message as not found', async () => {
    const owned = conversation()
    mocks.findOwnedById.mockResolvedValue(owned)
    mocks.findOwnedUserMessage.mockResolvedValue(null)
    await expect(AiConversationService.getOwnedUserMessage(event, actor, owned.id, 'foreign-message'))
      .rejects.toMatchObject({ statusCode: 404 })
  })
})
