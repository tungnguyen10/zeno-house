import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import BuildingReadinessCard from '~/components/buildings/BuildingReadinessCard.vue'
import UiSurfacePanel from '~/components/ui/UiSurfacePanel.vue'
import UiBadge from '~/components/ui/UiBadge.vue'
import type { BuildingReadiness, ReadinessCode } from '~/types/building-contract-profile'

function props(contractMissing: ReadinessCode[], billingMissing: ReadinessCode[]) {
  return {
    readiness: {
      contract: { ready: contractMissing.length === 0, missing: contractMissing },
      billing: { ready: billingMissing.length === 0, missing: billingMissing },
    } satisfies BuildingReadiness,
    settingsPath: '/dashboard/buildings/zeno/settings',
    editPath: '/dashboard/buildings/zeno/edit',
  }
}
function mountCard(contract: ReadinessCode[] = [], billing: ReadinessCode[] = []) {
  return mount(BuildingReadinessCard, {
    props: props(contract, billing),
    global: { stubs: {
      UiSurfacePanel, UiBadge, IconChevronDown: true, IconSpinner: true,
      NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
    } },
  })
}

describe('BuildingReadinessCard', () => {
  it('shows missing counts and maps repair links to contract, invoice, and edit destinations', async () => {
    const wrapper = mountCard(['lessor.id_number', 'invoice_profile'], ['billing.water_rate', 'billing.schedule'])
    expect(wrapper.text()).toContain('Lập hợp đồng')
    expect(wrapper.text()).toContain('Thiếu 2 mục')
    await wrapper.get('[data-test="readiness-contract-toggle"]').trigger('click')
    await wrapper.get('[data-test="readiness-billing-toggle"]').trigger('click')
    const links = wrapper.findAll('a')
    expect(links.map(link => link.attributes('href'))).toEqual([
      '/dashboard/buildings/zeno/settings#contract-profile',
      '/dashboard/buildings/zeno/settings#invoice-profile',
      '/dashboard/buildings/zeno/edit',
      '/dashboard/buildings/zeno/edit',
    ])
    expect(links[0]!.text()).toBe('Số CMND/CCCD bên cho thuê')
    expect(links[2]!.text()).toBe('Đơn giá nước')
  })

  it('uses native focusable buttons and exposes controlled list visibility independently', async () => {
    const wrapper = mountCard(['lessor.id_number'], ['invoice_profile'])
    const toggle = wrapper.get('[data-test="readiness-contract-toggle"]')
    expect(toggle.element.tagName).toBe('BUTTON')
    expect(toggle.attributes('type')).toBe('button')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    const controlled = wrapper.get(`[id="${toggle.attributes('aria-controls')}"]`)
    expect(controlled.attributes('hidden')).toBeDefined()
    await toggle.trigger('click') // Native buttons support Enter/Space activation without custom key handlers.
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(controlled.attributes('hidden')).toBeUndefined()
    expect(wrapper.get('[data-test="readiness-billing-toggle"]').attributes('aria-expanded')).toBe('false')
    await toggle.trigger('click')
    expect(controlled.attributes('hidden')).toBeDefined()
  })

  it('shows ready rows without a toggle, then reduces both-ready to one compact sentence', async () => {
    const wrapper = mountCard(['lessor.id_number'], [])
    expect(wrapper.text()).toContain('Sẵn sàng')
    expect(wrapper.find('[data-test="readiness-billing-toggle"]').exists()).toBe(false)
    await wrapper.setProps(props([], []))
    expect(wrapper.get('[data-test="readiness-compact"]').text()).toBe('Sẵn sàng lập hợp đồng và xuất hóa đơn')
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.find('a').exists()).toBe(false)
  })
})
