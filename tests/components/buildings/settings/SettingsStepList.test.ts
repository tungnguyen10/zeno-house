import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import SettingsStepList from '~/components/buildings/settings/SettingsStepList.vue'
import type { SetupStep } from '~/utils/building-setup-steps'

const stubs = {
  UiBadge: defineComponent({ setup(_, { slots }) { return () => h('span', { 'data-test': 'badge' }, slots.default?.()) } }),
  IconCheckSmall: true,
  IconChevronDown: true,
}

const steps: SetupStep[] = [
  { id: 'basics', label: 'Thông tin và lịch vận hành', summary: 'Điện 3.500 ₫', status: 'ready', missingCount: 0, required: true },
  { id: 'contract-profile', label: 'Hợp đồng', summary: 'Thiếu 2 mục', status: 'missing', missingCount: 2, required: true },
  { id: 'inventory-template', label: 'Nội thất mẫu', summary: 'Chưa có nội thất mẫu', status: 'optional', missingCount: 0, required: false },
  { id: 'service-defaults', label: 'Dịch vụ mặc định', summary: '3 dịch vụ bật · 1 chưa đặt giá', status: 'warning', missingCount: 1, required: false },
]

const mountList = (openId: string | null = null) => mount(SettingsStepList, {
  props: { steps, openId },
  slots: {
    'step-basics': '<div data-test="body-basics">Basics form</div>',
    'step-contract-profile': '<div data-test="body-contract">Contract form</div>',
    'step-contract-profile-actions': '<button data-test="extra-action">Khác</button>',
  },
  global: { stubs },
})

describe('SettingsStepList', () => {
  it('renders each step with its label, summary and status badge', () => {
    const w = mountList()
    const badges = w.findAll('[data-test="badge"]').map(b => b.text())

    expect(w.text()).toContain('Thông tin và lịch vận hành')
    expect(w.get('[data-test="step-summary-contract-profile"]').text()).toBe('Thiếu 2 mục')
    expect(badges).toEqual(['Hoàn tất', 'Thiếu 2 mục', 'Tùy chọn', 'Cần xem lại'])
  })

  it('keeps bodies closed until a step is opened', () => {
    const w = mountList()

    expect(w.find('[data-test="body-basics"]').exists()).toBe(false)
    expect(w.get('[data-test="step-toggle-basics"]').attributes('aria-expanded')).toBe('false')
  })

  it('shows only the open step body', () => {
    const w = mountList('contract-profile')

    expect(w.find('[data-test="body-contract"]').exists()).toBe(true)
    expect(w.find('[data-test="body-basics"]').exists()).toBe(false)
    expect(w.get('[data-test="step-toggle-contract-profile"]').attributes('aria-expanded')).toBe('true')
  })

  it('emits the clicked step id and closes the step when clicked again', async () => {
    const closed = mountList()
    await closed.get('[data-test="step-toggle-basics"]').trigger('click')
    expect(closed.emitted('update:openId')![0]).toEqual(['basics'])

    const open = mountList('basics')
    await open.get('[data-test="step-toggle-basics"]').trigger('click')
    expect(open.emitted('update:openId')![0]).toEqual([null])
  })

  it('exposes each step as a hash target and links the toggle to its panel', () => {
    const w = mountList('basics')

    expect(w.find('li#contract-profile').exists()).toBe(true)
    expect(w.get('[data-test="step-toggle-basics"]').attributes('aria-controls')).toBe('basics-panel')
    expect(w.find('#basics-panel').exists()).toBe(true)
  })

  it('renders per-step action slots outside the toggle button', () => {
    const w = mountList()
    const action = w.get('[data-test="extra-action"]')

    expect(action.element.closest('[data-test="step-toggle-contract-profile"]')).toBeNull()
  })

  it('hides the step number for unnumbered groups and honours a custom status label', () => {
    const w = mount(SettingsStepList, {
      props: {
        numbered: false,
        openId: null,
        steps: [{ id: 'finance-rules', label: 'Quy tắc vận hành', summary: '2 mục đang áp dụng', status: 'optional', missingCount: 0, statusLabel: 'Nâng cao' }],
      },
      global: { stubs },
    })

    expect(w.find('[aria-hidden="true"].rounded-full').exists()).toBe(false)
    expect(w.get('[data-test="badge"]').text()).toBe('Nâng cao')
  })

  it('renders a locked step as a disabled, non-expandable row', async () => {
    const w = mount(SettingsStepList, {
      props: {
        openId: 'lessor-profile',
        steps: [{ id: 'lessor-profile', label: 'Bên cho thuê', summary: 'Cần chủ tòa hoàn tất', status: 'missing', missingCount: 1, locked: true }],
      },
      slots: { 'step-lessor-profile': '<div data-test="body-lessor">Form</div>' },
      global: { stubs },
    })
    const toggle = w.get('[data-test="step-toggle-lessor-profile"]')

    expect(toggle.attributes('disabled')).toBeDefined()
    expect(w.get('[data-test="badge"]').text()).toBe('Cần chủ tòa')
    expect(w.find('[data-test="body-lessor"]').exists()).toBe(false)
    await toggle.trigger('click')
    expect(w.emitted('update:openId')).toBeUndefined()
  })
})
