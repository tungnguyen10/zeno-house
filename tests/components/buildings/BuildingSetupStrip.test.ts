import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import BuildingSetupStrip from '~/components/buildings/BuildingSetupStrip.vue'

const stubs = {
  UiSurfacePanel: defineComponent({ setup(_, { slots }) { return () => h('section', slots.default?.()) } }),
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
  setupPath: '/dashboard/buildings/zeno/settings?setup=1',
  createContractPath: '/dashboard/contracts/create?building_id=b1',
})

describe('BuildingSetupStrip', () => {
  it('shows progress, missing labels and links to the setup flow', () => {
    const w = mount(BuildingSetupStrip, {
      props: props(['lessor.id_number', 'invoice_profile'], []),
      global: { stubs },
    })
    expect(w.text()).toContain('Thiết lập 2/4')
    expect(w.text()).toContain('Bên cho thuê')
    expect(w.text()).toContain('Thanh toán trên hóa đơn')
    const link = w.find('a')
    expect(link.text()).toBe('Tiếp tục thiết lập')
    expect(link.attributes('href')).toBe('/dashboard/buildings/zeno/settings?setup=1')
  })

  it('shows the ready state with a create-contract link', () => {
    const w = mount(BuildingSetupStrip, { props: props([], []), global: { stubs } })
    expect(w.text()).toContain('Sẵn sàng lập hợp đồng')
    const link = w.find('a')
    expect(link.text()).toBe('Lập hợp đồng')
    expect(link.attributes('href')).toBe('/dashboard/contracts/create?building_id=b1')
  })
})
