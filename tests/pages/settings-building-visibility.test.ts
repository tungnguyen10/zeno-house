import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import Page from '~/pages/dashboard/settings/buildings.vue'

const buildings = [
  { id: 'b1', name: 'Zeno A', address: '1 A', isHidden: false },
  { id: 'b2', name: 'Zeno B', address: '2 B', isHidden: true },
  { id: 'b3', name: 'Zeno C', address: '3 C', isHidden: false },
]
const data = ref<{ data: unknown[] } | null>(null)
const status = ref('success')
const error = ref<unknown>(null)
const refresh = vi.fn()
const apiFetch = vi.fn()
const clearNuxtData = vi.fn()
const toast = { success: vi.fn(), error: vi.fn() }

const stubs = {
  UiPageHeader: { template: '<header><slot /></header>' },
  UiAlert: { template: '<div role="alert"><slot /></div>' },
  UiSkeleton: true,
  UiEmptyState: { props: ['title'], template: '<p data-empty>{{ title }}</p>' },
  UiBadge: { template: '<span data-badge><slot /></span>' },
  UiToggle: defineComponent({
    props: ['modelValue', 'ariaLabel', 'disabled'],
    emits: ['update:modelValue'],
    setup: (props, { emit }) => () => h('button', {
      'data-toggle': props.ariaLabel,
      disabled: props.disabled,
      onClick: () => emit('update:modelValue', !props.modelValue),
    }),
  }),
}

beforeEach(() => {
  vi.clearAllMocks()
  status.value = 'success'
  error.value = null
  data.value = { data: buildings }
  vi.stubGlobal('useFetch', vi.fn(() => ({ data, status, error, refresh })))
  vi.stubGlobal('apiFetch', apiFetch)
  vi.stubGlobal('clearNuxtData', clearNuxtData)
  vi.stubGlobal('useToast', () => toast)
  vi.stubGlobal('useAuthStore', () => ({ can: () => true }))
  vi.stubGlobal('definePageMeta', vi.fn())
  vi.stubGlobal('useIntersectionObserver', vi.fn())
  vi.stubGlobal('useAppHeaderTitle', () => ref(null))
})

describe('building visibility settings', () => {
  it('shows the visible count and a hidden badge only on hidden buildings', async () => {
    const wrapper = mount(Page, { global: { stubs } })
    await flushPromises()

    expect(wrapper.text()).toContain('2/3 tòa nhà đang hiển thị')
    const rows = wrapper.findAll('li')
    expect(rows).toHaveLength(3)
    expect(rows.map(r => r.find('[data-badge]').exists())).toEqual([false, true, false])
    expect(rows[1]!.find('[data-badge]').text()).toBe('Đang ẩn')
  })

  it('hides a building through the visibility endpoint and refreshes', async () => {
    apiFetch.mockResolvedValueOnce({})
    const wrapper = mount(Page, { global: { stubs } })
    await flushPromises()

    await wrapper.get('[data-toggle="Hiển thị Zeno A"]').trigger('click')
    await flushPromises()

    expect(apiFetch).toHaveBeenCalledWith('/api/buildings/b1/visibility', { method: 'PATCH', body: { is_hidden: true } })
    expect(clearNuxtData).toHaveBeenCalled()
    expect(refresh).toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('unhides a hidden building', async () => {
    apiFetch.mockResolvedValueOnce({})
    const wrapper = mount(Page, { global: { stubs } })
    await flushPromises()

    await wrapper.get('[data-toggle="Hiển thị Zeno B"]').trigger('click')
    await flushPromises()

    expect(apiFetch).toHaveBeenCalledWith('/api/buildings/b2/visibility', { method: 'PATCH', body: { is_hidden: false } })
  })

  it('toasts when the request fails and does not refresh', async () => {
    apiFetch.mockRejectedValueOnce(new Error('boom'))
    const wrapper = mount(Page, { global: { stubs } })
    await flushPromises()

    await wrapper.get('[data-toggle="Hiển thị Zeno A"]').trigger('click')
    await flushPromises()

    expect(toast.error).toHaveBeenCalledWith('Không thể đổi hiển thị tòa nhà.')
    expect(refresh).not.toHaveBeenCalled()
    expect(wrapper.get('[data-toggle="Hiển thị Zeno A"]').attributes('disabled')).toBeUndefined()
  })

  it('shows the empty state with corrected spelling when there are no buildings', async () => {
    data.value = { data: [] }
    const wrapper = mount(Page, { global: { stubs } })
    await flushPromises()

    expect(wrapper.get('[data-empty]').text()).toBe('Chưa có tòa nhà nào')
  })
})
