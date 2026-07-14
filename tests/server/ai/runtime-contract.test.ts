import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('AI runtime safety contracts', () => {
  it('bounds model tool loops and keeps persistence on an independent stream branch', () => {
    const source = read('server/services/ai/chat.ts')
    expect(source).toContain('stopWhen: isStepCount(config.maxSteps)')
    expect(source).toContain('result.stream.tee()')
    expect(source).toContain('persistenceBranch.getReader()')
    expect(source).toContain('AiConversationService.appendAssistantMessage')
    expect(source).toContain('abortSignal: AbortSignal.timeout(runtimePolicy.providerTimeoutMs)')
    expect(source.indexOf('if (!runtimePolicy.chatEnabled)')).toBeLessThan(source.indexOf('AiConversationService.resolve'))
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
