import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import Page from '~/pages/dashboard/settings/building-settings.vue'

const data = ref<{ data: unknown[] } | null>(null)
const status = ref('success')
const error = ref<unknown>(null)
const refresh = vi.fn()

const stubs = {
  UiPageHeader: { template: '<header><slot /></header>' },
  UiAlert: { template: '<div role="alert"><slot /></div>' },
  UiSkeleton: { template: '<div data-skeleton />' },
  UiEmptyState: { props: ['title'], template: '<p data-empty>{{ title }}</p>' },
  IconChevronRight: true,
  NuxtLink: defineComponent({ props: ['to'], setup: (props, { slots }) => () => h('a', { href: props.to }, slots.default?.()) }),
}

beforeEach(() => {
  vi.clearAllMocks()
  status.value = 'success'
  error.value = null
  data.value = { data: [{ id: 'b1', slug: 'zeno-dda', code: 'zhpn', name: 'Zeno House Đào Duy Anh', address: '88 Đào Duy Anh' }] }
  vi.stubGlobal('useFetch', vi.fn(() => ({ data, status, error, refresh })))
  vi.stubGlobal('useIntersectionObserver', vi.fn())
  vi.stubGlobal('useAppHeaderTitle', () => ref(null))
})

describe('building settings entry', () => {
  it('links each building to its settings page', async () => {
    const wrapper = mount(Page, { global: { stubs } })
    await flushPromises()

    const link = wrapper.get('a')
    expect(link.text()).toContain('Zeno House Đào Duy Anh')
    expect(link.attributes('href')).toMatch(/\/settings$/)
  })

  it('shows an empty state when no building is in scope', async () => {
    data.value = { data: [] }
    const wrapper = mount(Page, { global: { stubs } })
    await flushPromises()

    expect(wrapper.get('[data-empty]').text()).toBe('Chưa có tòa nhà nào trong phạm vi của bạn')
  })

  it('offers a retry when loading fails', async () => {
    error.value = new Error('boom')
    const wrapper = mount(Page, { global: { stubs } })
    await flushPromises()

    await wrapper.get('[role="alert"] button').trigger('click')
    expect(refresh).toHaveBeenCalled()
  })
})
