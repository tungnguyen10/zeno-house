import { mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

const iconStubs = {
  IconInfoCircle: true,
  IconMessageCircle: true,
  IconSend: true,
  IconTrash: true,
  IconX: true,
}

function mountChat() {
  return mount(AppAiDevChat, {
    global: {
      stubs: {
        AppAiActionCard: {
          props: ['plan'],
          template: '<div data-testid="action-card">{{ plan.title }}</div>',
        },
        ...iconStubs,
      },
    },
  })
}

function stubAiChat(options: {
  messages?: Array<{ role: 'user' | 'assistant', content: string, actionPlanIds: string[] }>
  actionPlans?: AiActionPlanDto[]
} = {}) {
  const prompt = ref('')
  const send = vi.fn()
  const actionPlans = options.actionPlans ?? []

  vi.stubGlobal('useAiChat', () => ({
    conversationId: ref('conversation-1'),
    messages: ref(options.messages ?? []),
    actionPlans: ref(actionPlans),
    prompt,
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
      actionPlans.filter(plan => message.actionPlanIds.includes(plan.id)),
    send,
    resume: vi.fn(),
    confirmAction: vi.fn(),
    cancelAction: vi.fn(),
    clearChat: vi.fn(),
    abort: vi.fn(),
  }))

  return { prompt, send }
}

describe('AppAiDevChat', () => {
  beforeEach(() => {
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { aiDevChatEnabled: true } }))
  })

  it('keeps a completed action beside the assistant message that created it', async () => {
    stubAiChat({
      messages: [
        { role: 'user', content: 'Ghi thu phòng 02.', actionPlanIds: [] },
        { role: 'assistant', content: 'Hãy xác nhận khoản thu.', actionPlanIds: ['plan-1'] },
        { role: 'user', content: 'Kỳ mới là tháng nào?', actionPlanIds: [] },
        { role: 'assistant', content: 'Kỳ mới là tháng 08/2026.', actionPlanIds: [] },
      ],
      actionPlans: [completedPayment],
    })
    const wrapper = mountChat()

    await wrapper.get('button').trigger('click')
    await nextTick()

    const html = wrapper.html()
    const cardIndex = html.indexOf('data-testid="action-card"')
    expect(html.indexOf('Hãy xác nhận khoản thu.')).toBeLessThan(cardIndex)
    expect(cardIndex).toBeLessThan(html.indexOf('Kỳ mới là tháng nào?'))
  })

  it('shows every operator-facing AI task in grouped suggestions', async () => {
    stubAiChat()
    const wrapper = mountChat()

    await wrapper.get('button').trigger('click')
    await nextTick()

    expect(wrapper.text()).toContain('Kỳ billing')
    expect(wrapper.text()).toContain('Chỉ số')
    expect(wrapper.text()).toContain('Hóa đơn')

    const expectedSuggestions = [
      'Mở kỳ billing hiện tại.',
      'Xem tổng quan kỳ billing hiện tại.',
      'Tính và giải thích billing draft kỳ hiện tại.',
      'Kiểm tra tiến độ nhập chỉ số điện nước kỳ hiện tại.',
      'Tôi muốn nhập hàng loạt chỉ số điện nước; hãy yêu cầu tôi dán dữ liệu.',
      'Sửa một chỉ số điện nước đã nhập.',
      'Điều chỉnh mức tiêu thụ điện nước của một phòng.',
      'Xem trước và phát hành hóa đơn kỳ hiện tại.',
      'Ghi thu các phòng còn nợ kỳ hiện tại.',
      'Huỷ một hóa đơn chưa ghi thu.',
      'Phát hành lại một hóa đơn đã huỷ.',
      'Điều chỉnh một hóa đơn đã ghi thu hoặc ghi thu một phần.',
    ]

    for (const suggestion of expectedSuggestions) {
      expect(wrapper.text()).toContain(suggestion)
    }
    expect(wrapper.findAll('[data-testid^="ai-suggestion-"]')).toHaveLength(12)
    expect(wrapper.text()).not.toContain('get_user_context')
    expect(wrapper.text()).not.toContain('list_buildings')
  })

  it('sends a clicked suggestion through the existing chat flow', async () => {
    const { prompt, send } = stubAiChat()
    const wrapper = mountChat()

    await wrapper.get('button').trigger('click')
    await wrapper.get('[data-testid="ai-suggestion-record-payments"]').trigger('click')

    expect(prompt.value).toBe('Ghi thu các phòng còn nợ kỳ hiện tại.')
    expect(send).toHaveBeenCalledOnce()
  })
})
