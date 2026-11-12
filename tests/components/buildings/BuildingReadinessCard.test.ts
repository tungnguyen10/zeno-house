import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import BuildingReadinessCard from '~/components/buildings/BuildingReadinessCard.vue'

const stubs = {
  UiSurfacePanel: defineComponent({ setup(_, { slots }) { return () => h('section', slots.default?.()) } }),
  UiBadge: defineComponent({ setup(_, { slots }) { return () => h('span', slots.default?.()) } }),
  NuxtLink: defineComponent({
    props: ['to'],
    setup(props, { slots }) { return () => h('a', { href: props.to }, slots.default?.()) },
  }),
}

const props = (contractMissing: string[], billingMissing: string[]) => ({
  readiness: {
    contract: { ready: contractMissing.length === 0, missing: contractMissing },
    billing: { ready: billingMissing.length === 0, missing: billingMissing },
  } as never,
  settingsPath: '/dashboard/buildings/zeno/settings',
  editPath: '/dashboard/buildings/zeno/edit',
})

describe('BuildingReadinessCard', () => {
  it('shows missing counts and links each item to its anchor', async () => {
    const w = mount(BuildingReadinessCard, { props: props(['lessor.id_number', 'invoice_profile'], ['billing.water_rate']), global: { stubs } })
    expect(w.text()).toContain('Lập hợp đồng')
    expect(w.text()).toContain('Thiếu 2 mục')
    await w.find('[data-test="readiness-contract-toggle"]').trigger('click')
    const hrefs = w.findAll('a').map(a => a.attributes('href'))
    expect(hrefs).toContain('/dashboard/buildings/zeno/settings#contract-profile')
    expect(hrefs).toContain('/dashboard/buildings/zeno/settings#invoice-profile')
  })

  it('collapses to a compact ready state', () => {
    const w = mount(BuildingReadinessCard, { props: props([], []), global: { stubs } })
    expect(w.find('[data-test="readiness-compact"]').exists()).toBe(true)
  })
})
