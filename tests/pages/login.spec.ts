import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

const login = vi.fn()
const loginWithGoogle = vi.fn()
const navigateTo = vi.fn()

vi.stubGlobal('definePageMeta', vi.fn())
vi.stubGlobal('navigateTo', navigateTo)
vi.stubGlobal('useAuth', () => ({ login, loginWithGoogle }))

const LoginPage = (await import('../../app/pages/login.vue')).default

const UiInputStub = defineComponent({
  props: ['modelValue', 'type', 'disabled'],
  emits: ['update:modelValue'],
  template: `
    <input
      :type="type"
      :value="modelValue"
      :disabled="disabled"
      @input="$emit('update:modelValue', $event.target.value)"
    >
  `,
})

const UiButtonStub = defineComponent({
  props: ['type', 'loading', 'disabled'],
  template: `
    <button
      :type="type || 'button'"
      :disabled="loading || disabled"
      :data-loading="String(Boolean(loading))"
    ><slot /></button>
  `,
})

const AuthPasswordFieldStub = defineComponent({
  props: ['modelValue', 'disabled'],
  emits: ['update:modelValue'],
  template: `
    <input
      type="password"
      :value="modelValue"
      :disabled="disabled"
      @input="$emit('update:modelValue', $event.target.value)"
    >
  `,
})

function mountLogin() {
  return mount(LoginPage, {
    global: {
      stubs: {
        AuthPasswordField: AuthPasswordFieldStub,
        IconGoogle: true,
        IconMail: true,
        IconLogo: true,
        NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
        UiAlert: { template: '<div role="alert"><slot /></div>' },
        UiButton: UiButtonStub,
        UiInput: UiInputStub,
      },
    },
  })
}

async function fillCredentials(wrapper: ReturnType<typeof mountLogin>) {
  const [email, password] = wrapper.findAll('input')
  await email!.setValue('admin@zeno.test')
  await password!.setValue('wrong-password')
}

describe('login page', () => {
  beforeEach(() => {
    login.mockReset()
    loginWithGoogle.mockReset()
    navigateTo.mockReset()
  })

  it('shows the credentials error without redirecting', async () => {
    login.mockRejectedValue(new Error('Sai thông tin đăng nhập'))
    const wrapper = mountLogin()
    await fillCredentials(wrapper)

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toBe('Sai thông tin đăng nhập')
    expect(navigateTo).not.toHaveBeenCalled()
  })

  it('disables the submit button while login is in flight', async () => {
    let resolveLogin!: () => void
    login.mockReturnValue(new Promise<void>((resolve) => { resolveLogin = resolve }))
    const wrapper = mountLogin()
    await fillCredentials(wrapper)

    await wrapper.get('form').trigger('submit')

    const submit = wrapper.get('button[type="submit"]')
    expect(submit.attributes('disabled')).toBeDefined()
    expect(submit.attributes('data-loading')).toBe('true')

    resolveLogin()
    await flushPromises()

    expect(submit.attributes('disabled')).toBeUndefined()
    expect(submit.attributes('data-loading')).toBe('false')
  })
})
