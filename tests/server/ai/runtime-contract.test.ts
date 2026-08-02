import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('AI runtime safety contracts', () => {
  it('bounds model context/tool loops and registers independent persistence', () => {
    const source = read('server/services/ai/chat.ts')
    const persistenceSource = read('server/services/ai/persistence.ts')
    expect(source).toContain('stopWhen: isStepCount(config.maxSteps)')
    expect(source).toContain('result.stream.tee()')
    expect(persistenceSource).toContain('stream.getReader()')
    expect(persistenceSource).toContain('event.waitUntil(promise)')
    expect(source).toContain('selectBoundedHistory(')
    expect(source).toContain('registerAiPersistence(event, persistencePromise)')
    expect(source).toContain('AiConversationService.appendAssistantMessage')
    expect(source).toContain('AiConversationService.beginTurn')
    expect(source).toContain('abortSignal: AbortSignal.timeout(runtimePolicy.providerTimeoutMs)')
    expect(source.indexOf('if (!runtimePolicy.chatEnabled)')).toBeLessThan(source.indexOf('AiConversationService.beginTurn'))
    expect(source).toContain("'X-AI-Requested-Model': config.modelPrimary")
    expect(source).not.toContain("'X-AI-Model'")
  })

  it.each(['confirm', 'cancel'])('%s endpoint requires auth and validates a server action id', (operation) => {
    const source = read(`server/api/ai/actions/[id]/${operation}.post.ts`)
    expect(source).toContain('requireAuth(event)')
    expect(source).toContain('aiActionIdSchema.safeParse')
    expect(source).toContain(`AiActionService.${operation}`)
  })

  it('never sends a client-generated idempotency key from the chat composable', () => {
    const source = read('app/composables/useAiChat.ts')
    expect(source).toContain('JSON.stringify({ id: conversationId.value ?? undefined, message: content })')
    expect(source).not.toContain('idempotency_key')
  })
})
