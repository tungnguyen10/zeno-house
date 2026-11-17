import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import SettingsReadinessCard from '~/components/buildings/settings/SettingsReadinessCard.vue'
import type { SetupFlow } from '~/utils/building-setup-steps'

const stubs = {
  UiSurfacePanel: defineComponent({ setup(_, { slots }) { return () => h('section', slots.default?.()) } }),
  UiButton: defineComponent({
    emits: ['click'],
    setup(_, { slots, emit }) { return () => h('button', { type: 'button', onClick: () => emit('click') }, slots.default?.()) },
  }),
  NuxtLink: defineComponent({
    props: ['to'],
    setup(props, { slots }) { return () => h('a', { href: props.to }, slots.default?.()) },
  }),
}

const step = (id: string, label: string, status: 'ready' | 'missing') => ({
  id, label, summary: '', status, missingCount: status === 'missing' ? 1 : 0, required: true,
})

function flow(overrides: Partial<SetupFlow> = {}): SetupFlow {
  return {
    steps: [step('basics', 'Thông tin và lịch vận hành', 'ready'), step('contract-profile', 'Hợp đồng', 'missing')] as never,
    requiredTotal: 3,
    requiredReady: 2,
    ready: false,
    nextStepId: 'contract-profile',
    ...overrides,
  }
}

const mountCard = (f: SetupFlow) => mount(SettingsReadinessCard, {
  props: { flow: f, createContractPath: '/dashboard/contracts/create?building=zeno' },
  global: { stubs },
})

describe('SettingsReadinessCard', () => {
  it('shows progress and a continue action for the next missing step', async () => {
    const w = mountCard(flow())

    expect(w.get('[data-test="setup-progress"]').text()).toBe('2/3 bước bắt buộc đã xong')
    expect(w.text()).toContain('Chưa sẵn sàng lập hợp đồng')
    expect(w.get('[data-test="setup-next"]').text()).toContain('Hợp đồng')

    await w.get('[data-test="setup-next"]').trigger('click')
    expect(w.emitted('open-step')![0]).toEqual(['contract-profile'])
  })

  it('shows the create contract link once everything required is ready', () => {
    const w = mountCard(flow({ requiredReady: 3, ready: true, nextStepId: null }))

    expect(w.text()).toContain('Sẵn sàng lập hợp đồng')
    expect(w.find('[data-test="setup-next"]').exists()).toBe(false)
    expect(w.get('[data-test="setup-create-contract"]').attributes('href')).toBe('/dashboard/contracts/create?building=zeno')
  })

  it('offers exit in setup mode and the first-contract CTA once ready', async () => {
    const w = mount(SettingsReadinessCard, {
      props: {
        flow: flow({ requiredReady: 3, ready: true, nextStepId: null }),
        createContractPath: '/dashboard/contracts/create?building_id=b-1',
        setupMode: true,
        buildingPath: '/dashboard/buildings/zeno',
      },
      global: { stubs },
    })

    expect(w.get('[data-test="setup-create-contract"]').text()).toBe('Lập hợp đồng đầu tiên')
    expect(w.get('[data-test="setup-view-building"]').attributes('href')).toBe('/dashboard/buildings/zeno')
    await w.get('[data-test="setup-exit"]').trigger('click')
    expect(w.emitted('exit-setup')).toHaveLength(1)
  })

  it('hides exit outside setup mode', () => {
    expect(mountCard(flow()).find('[data-test="setup-exit"]').exists()).toBe(false)
  })

  it('exposes progress to assistive tech', () => {
    const bar = mountCard(flow()).get('[role="progressbar"]')

    expect(bar.attributes('aria-valuenow')).toBe('2')
    expect(bar.attributes('aria-valuemax')).toBe('3')
  })

  it('does not divide by zero when no required step is visible', () => {
    const w = mountCard(flow({ steps: [], requiredTotal: 0, requiredReady: 0, ready: true, nextStepId: null }))

    expect(w.get('[role="progressbar"] > div').attributes('style')).toContain('width: 0%')
  })
})
