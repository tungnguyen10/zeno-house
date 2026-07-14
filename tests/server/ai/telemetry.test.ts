import { describe, expect, it, vi } from 'vitest'
import { emitAiTelemetry } from '../../../server/utils/ai-telemetry'

describe('AI telemetry', () => {
  it('emits correlation metadata without conversation content or payloads', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    emitAiTelemetry({ path: '/api/ai/chat' } as never, {
      event: 'ai.tool',
      requestId: 'request-1',
      conversationId: 'conversation-1',
      toolName: 'get_meter_status',
      model: 'model-1',
      outcome: 'succeeded',
      durationMs: 12,
    })

    expect(warning).toHaveBeenCalledOnce()
    const serialized = String(warning.mock.calls[0]?.[1])
    expect(JSON.parse(serialized)).toMatchObject({
      event: 'ai.tool',
      route: '/api/ai/chat',
      requestId: 'request-1',
      conversationId: 'conversation-1',
      toolName: 'get_meter_status',
      model: 'model-1',
      outcome: 'succeeded',
      durationMs: 12,
    })
    expect(serialized).not.toContain('message')
    expect(serialized).not.toContain('payload')
    warning.mockRestore()
  })
})
