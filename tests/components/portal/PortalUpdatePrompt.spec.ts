import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import PortalUpdatePrompt from '~/components/portal/PortalUpdatePrompt.vue'

const ready = ref(true)
const dirty = ref(false)
const updating = ref(false)
const sequence = ref(1)
const apply = vi.fn()
const states: Record<string, unknown> = {
  'pwa-update-ready': ready,
  'portal-form-dirty': dirty,
  'pwa-updating': updating,
  'pwa-other-form-dirty': ref(false),
  'pwa-update-error': ref(null),
  'pwa-update-sequence': sequence,
}
const stubs = {
  ClientOnly: { template: '<div><slot /></div>' },
  Teleport: true,
  PortalButton: { props: ['disabled', 'loading'], template: '<button :disabled="disabled || loading"><slot /></button>' },
}
beforeEach(() => {
  vi.clearAllMocks()
  ready.value = true
  dirty.value = false
  updating.value = false
  sequence.value = 1
  vi.stubGlobal('useRoute', () => ({ path: '/portal' }))
  vi.stubGlobal('useNuxtApp', () => ({ $pwaUpdate: { apply } }))
  vi.stubGlobal('useState', (key: string) => states[key])
  vi.stubGlobal('usePortalTheme', () => ({ resolvedTheme: ref('light') }))
})

describe('PWA update prompt', () => {
  it('uses the compact overlay host and waits for explicit confirmation', async () => {
    const wrapper = mount(PortalUpdatePrompt, { global: { stubs } })
    expect(wrapper.get('aside').classes()).toContain('portal-install-host')
    expect(apply).not.toHaveBeenCalled()
    await wrapper.get('button').trigger('click')
    expect(apply).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('disables update while a form is dirty and allows dismissal without reload', async () => {
    dirty.value = true
    const wrapper = mount(PortalUpdatePrompt, { global: { stubs } })
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Hoàn tất thông tin đang nhập')
    await wrapper.findAll('button')[1]!.trigger('click')
    expect(wrapper.find('aside').exists()).toBe(false)
    expect(apply).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('offers a later release even if the previous update was dismissed on this route', async () => {
    const wrapper = mount(PortalUpdatePrompt, { global: { stubs } })
    await wrapper.findAll('button')[1]!.trigger('click')
    expect(wrapper.find('aside').exists()).toBe(false)
    sequence.value += 1
    await wrapper.vm.$nextTick()
    expect(wrapper.find('aside').exists()).toBe(true)
    expect(apply).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
