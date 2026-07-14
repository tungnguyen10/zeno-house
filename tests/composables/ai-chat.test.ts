import { describe, expect, it } from 'vitest'
import { parseAiSseFrames } from '../../app/composables/useAiChat'

describe('AI SSE parser', () => {
  it('keeps fragmented frames until they are complete', () => {
    const first = parseAiSseFrames('data: {"type":"text-delta","text":"Xin')
    expect(first.events).toEqual([])
    expect(first.remainder).toContain('text-delta')

    const second = parseAiSseFrames(`${first.remainder} chào"}\n\n`)
    expect(second.events).toEqual([{ type: 'text-delta', text: 'Xin chào' }])
    expect(second.remainder).toBe('')
  })

  it('parses tool, action, error, and done events in order', () => {
    const source = [
      { type: 'tool-status', tool: 'get_meter_status', status: 'succeeded' },
      { type: 'action-plan', plan: { id: 'plan-1', status: 'pending' } },
      { type: 'error', error: { code: 'CONFLICT', message: 'Stale' } },
      { type: 'done', conversationId: 'conversation-1', requestId: 'request-1', model: 'model-1' },
    ].map(event => `data: ${JSON.stringify(event)}\n\n`).join('')

    expect(parseAiSseFrames(source).events.map(event => event.type)).toEqual([
      'tool-status', 'action-plan', 'error', 'done',
    ])
  })

  it('ignores malformed frames without discarding later valid events', () => {
    const parsed = parseAiSseFrames('data: nope\n\ndata: {"type":"text-delta","text":"ok"}\n\n')
    expect(parsed.events).toEqual([{ type: 'text-delta', text: 'ok' }])
  })
})
