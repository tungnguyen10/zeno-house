import { describe, expect, it, vi } from 'vitest'
import { consumeAiPersistence, registerAiPersistence } from '../../../server/services/ai/persistence'

function stream(parts: unknown[]) {
  return new ReadableStream({
    start(controller) {
      for (const part of parts) controller.enqueue(part)
      controller.close()
    },
  }) as never
}

describe('AI assistant persistence lifecycle', () => {
  it('collects assistant text and tool names from the independent stream', async () => {
    await expect(consumeAiPersistence(stream([
      { type: 'text-delta', text: 'Xin ' },
      { type: 'tool-call', toolName: 'list_buildings' },
      { type: 'text-delta', text: 'chào' },
    ]))).resolves.toEqual({
      text: 'Xin chào', tools: ['list_buildings'], failed: false, aborted: false,
    })
  })

  it('normalizes provider errors and aborts for durable failure metadata', async () => {
    await expect(consumeAiPersistence(stream([
      { type: 'error', error: new Error('provider') },
      { type: 'abort', reason: 'timeout' },
    ]))).resolves.toEqual({ text: '', tools: [], failed: true, aborted: true })
  })

  it('registers persistence with the request lifecycle independently of the client', async () => {
    const waitUntil = vi.fn()
    const persistence = Promise.resolve('persisted')
    expect(registerAiPersistence({ waitUntil } as never, persistence)).toBe(persistence)
    expect(waitUntil).toHaveBeenCalledWith(persistence)
    await expect(persistence).resolves.toBe('persisted')
  })
})
