import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

const requestPasswordReset = vi.fn()
const refreshSession = vi.fn()
const logout = vi.fn()
const fetchMock = vi.fn()

vi.stubGlobal('definePageMeta', vi.fn())
vi.stubGlobal('useAuth', () => ({ requestPasswordReset, refreshSession, logout }))
vi.stubGlobal('$fetch', fetchMock)
vi.stubGlobal('navigateTo', vi.fn())

const UiInputStub = defineComponent({
  props: ['modelValue', 'type', 'disabled'],
  emits: ['update:modelValue'],
  template: '<input :type="type" :value="modelValue" :disabled="disabled" @input="$emit(\'update:modelValue\', $event.target.value)">',
})
const UiButtonStub = defineComponent({
  props: ['type', 'loading'],
  template: '<button :type="type || \'button\'" :disabled="loading"><slot /></button>',
})
const common = {
  UiAlert: { props: ['title'], template: '<div role="alert">{{ title }} <slot /></div>' },
  UiButton: UiButtonStub,
  UiInput: UiInputStub,
  UiSkeleton: { template: '<div data-skeleton />' },
  IconRefresh: true,
  NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
}

describe('auth lifecycle pages', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => vi.useRealTimers())

  it('shows the same recovery completion message when Supabase rejects the request', async () => {
    requestPasswordReset.mockRejectedValue(new Error('not found'))
    const Page = (await import('../../app/pages/forgot-password.vue')).default
    const wrapper = mount(Page, { global: { stubs: common } })
    await wrapper.get('input').setValue('person@example.com')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Nếu tài khoản tồn tại')
  })

  it('shows only the current rejected request reason and offers logout', async () => {
    fetchMock.mockResolvedValue({
      data: { status: 'rejected', email: 'long@example.com', rejectionReason: 'Không đủ thông tin', decisionRole: null },
    })
    const Page = (await import('../../app/pages/auth/pending.vue')).default
    const wrapper = mount(Page, { global: { stubs: common } })
    await flushPromises()
    expect(wrapper.text()).toContain('Không đủ thông tin')
    expect(wrapper.text()).toContain('long@example.com')
    await wrapper.get('button:last-of-type').trigger('click')
    expect(logout).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
})
