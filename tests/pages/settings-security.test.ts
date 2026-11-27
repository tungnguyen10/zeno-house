import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import Page from '~/pages/dashboard/settings/security.vue'

const change = vi.fn()
const navigateTo = vi.fn()
const toast = { success: vi.fn(), error: vi.fn() }

const UiInput = defineComponent({
  props: ['modelValue', 'label', 'error'],
  emits: ['update:modelValue', 'blur'],
  setup: (props, { emit }) => () => h('div', [
    h('input', {
      'data-label': props.label,
      value: props.modelValue,
      onInput: (e: Event) => emit('update:modelValue', (e.target as HTMLInputElement).value),
      onBlur: () => emit('blur'),
    }),
    props.error ? h('p', { 'data-error': props.label }, props.error) : null,
  ]),
})

const stubs = {
  UiPageHeader: { template: '<header><slot /></header>' },
  UiSurfacePanel: { template: '<div><slot /></div>' },
  UiInput,
  UiButton: defineComponent({
    props: ['type', 'disabled'],
    setup: (props, { slots }) => () => h('button', { type: props.type, disabled: props.disabled }, slots.default?.()),
  }),
}

function input(wrapper: ReturnType<typeof mount>, label: string) {
  return wrapper.get(`input[data-label="${label}"]`)
}

async function fillForm(wrapper: ReturnType<typeof mount>) {
  await input(wrapper, 'Mật khẩu hiện tại').setValue('OldPassw0rd!')
  await input(wrapper, 'Mật khẩu mới').setValue('NewPassw0rd!')
  await input(wrapper, 'Xác nhận mật khẩu mới').setValue('NewPassw0rd!')
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('navigateTo', navigateTo)
  vi.stubGlobal('useIntersectionObserver', vi.fn())
  vi.stubGlobal('useAppHeaderTitle', () => ref(null))
  vi.stubGlobal('useToast', () => toast)
  vi.stubGlobal('useUserPassword', () => ({ change, saving: ref(false), fieldErrors: ref({}) }))
})

describe('settings security', () => {
  it('clears the fields, toasts and stays on the page after a successful change', async () => {
    change.mockResolvedValueOnce(true)
    const wrapper = mount(Page, { global: { stubs } })
    await fillForm(wrapper)

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(change).toHaveBeenCalledTimes(1)
    expect(toast.success).toHaveBeenCalledWith('Đã đổi mật khẩu.')
    expect(navigateTo).not.toHaveBeenCalled()
    for (const label of ['Mật khẩu hiện tại', 'Mật khẩu mới', 'Xác nhận mật khẩu mới']) {
      expect((input(wrapper, label).element as HTMLInputElement).value).toBe('')
    }
    expect(wrapper.find('[data-error]').exists()).toBe(false)
  })

  it('keeps the values and does not toast when the change fails', async () => {
    change.mockResolvedValueOnce(false)
    const wrapper = mount(Page, { global: { stubs } })
    await fillForm(wrapper)

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(toast.success).not.toHaveBeenCalled()
    expect(navigateTo).not.toHaveBeenCalled()
    expect((input(wrapper, 'Mật khẩu hiện tại').element as HTMLInputElement).value).toBe('OldPassw0rd!')
    expect((input(wrapper, 'Mật khẩu mới').element as HTMLInputElement).value).toBe('NewPassw0rd!')
    expect((input(wrapper, 'Xác nhận mật khẩu mới').element as HTMLInputElement).value).toBe('NewPassw0rd!')
  })
})
