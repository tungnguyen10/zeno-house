import { describe, expect, it } from 'vitest'
import { invoicePaymentConfirmationMessage, parseAiSseFrames } from '../../app/composables/useAiChat'

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
      {
        type: 'done', conversationId: 'conversation-1', requestId: 'request-1',
        model: 'fallback-model', requestedModel: 'primary-model', fallbackUsed: true, provider: 'openrouter',
      },
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

describe('AI invoice payment confirmation feedback', () => {
  const paymentPlan = (count: number) => ({
    id: 'plan-1', actionType: 'record_invoice_payments', status: 'succeeded',
    result: {
      count, totalAmount: count === 1 ? 1_000_000 : 5_000_000,
      invoices: [{ roomNumber: '02' }],
    },
  }) as never

  it('formats single and batch payment success messages', () => {
    expect(invoicePaymentConfirmationMessage(paymentPlan(1), false))
      .toBe('Đã ghi thu phòng 02: 1.000.000 ₫.')
    expect(invoicePaymentConfirmationMessage(paymentPlan(5), false))
      .toBe('Đã ghi thu 5 phòng: 5.000.000 ₫.')
  })

  it('prioritizes the idempotent replay message', () => {
    expect(invoicePaymentConfirmationMessage(paymentPlan(1), true))
      .toBe('Các khoản thu này đã được ghi nhận trước đó.')
  })

  it('does not create a payment toast for another action type', () => {
    expect(invoicePaymentConfirmationMessage({ ...paymentPlan(1), actionType: 'issue_invoices' }, false)).toBeNull()
  })
})
