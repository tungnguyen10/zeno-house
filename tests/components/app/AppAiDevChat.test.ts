import { mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type { AiActionPlanDto } from '~/types/ai'
import AppAiDevChat from '../../../app/components/app/AppAiDevChat.vue'

const completedPayment: AiActionPlanDto = {
  id: 'plan-1',
  conversationId: 'conversation-1',
  actionType: 'record_invoice_payments',
  status: 'succeeded',
  title: 'Ghi thu phòng 02',
  summary: 'Đã ghi thu đủ.',
  buildingId: 'building-1',
  preview: {},
  warnings: [],
  expiresAt: '2026-08-03T12:00:00.000Z',
}

describe('AppAiDevChat', () => {
  it('keeps a completed action beside the assistant message that created it', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { aiDevChatEnabled: true } }))
    vi.stubGlobal('useAiChat', () => ({
      conversationId: ref('conversation-1'),
      messages: ref([
        { role: 'user', content: 'Ghi thu phòng 02.', actionPlanIds: [] },
        { role: 'assistant', content: 'Hãy xác nhận khoản thu.', actionPlanIds: ['plan-1'] },
        { role: 'user', content: 'Kỳ mới là tháng nào?', actionPlanIds: [] },
        { role: 'assistant', content: 'Kỳ mới là tháng 08/2026.', actionPlanIds: [] },
      ]),
      actionPlans: ref([completedPayment]),
      prompt: ref(''),
      sending: ref(false),
      canSend: ref(false),
      lastModel: ref(null),
      lastProvider: ref(null),
      lastToolCalls: ref([]),
      errorCode: ref(null),
      errorDetails: ref(null),
      actionErrors: ref({}),
      actionBusyId: ref(null),
      actionPlansForMessage: (message: { actionPlanIds: string[] }) =>
        message.actionPlanIds.includes(completedPayment.id) ? [completedPayment] : [],
      send: vi.fn(),
      resume: vi.fn(),
      confirmAction: vi.fn(),
      cancelAction: vi.fn(),
      clearChat: vi.fn(),
      abort: vi.fn(),
    }))

    const wrapper = mount(AppAiDevChat, {
      global: {
        stubs: {
          AppAiActionCard: {
            props: ['plan'],
            template: '<div data-testid="action-card">{{ plan.title }}</div>',
          },
          IconInfoCircle: true,
          IconMessageCircle: true,
          IconSend: true,
          IconTrash: true,
          IconX: true,
        },
      },
    })

    await wrapper.get('button').trigger('click')
    await nextTick()

    const html = wrapper.html()
    const cardIndex = html.indexOf('data-testid="action-card"')
    expect(html.indexOf('Hãy xác nhận khoản thu.')).toBeLessThan(cardIndex)
    expect(cardIndex).toBeLessThan(html.indexOf('Kỳ mới là tháng nào?'))
  })
})
