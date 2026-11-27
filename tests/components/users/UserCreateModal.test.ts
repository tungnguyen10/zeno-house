import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import UserCreateModal from '~/components/users/UserCreateModal.vue'

const UiInput = defineComponent({
  props: ['modelValue', 'label', 'error'],
  emits: ['update:modelValue'],
  setup: (props, { emit }) => () => h('label', [
    props.label,
    h('input', { 'data-label': props.label, value: props.modelValue, onInput: (e: Event) => emit('update:modelValue', (e.target as HTMLInputElement).value) }),
    props.error ? h('em', { 'data-error': props.label }, props.error) : null,
  ]),
})

const stubs = {
  UiModal: { props: ['open'], template: '<div v-if="open"><slot /><slot name="footer" /></div>' },
  UiInput,
  UiSelect: { props: ['modelValue'], template: '<select />' },
  UiAlert: { template: '<div data-alert><slot /></div>' },
  IconPlus: true,
}

const props = {
  open: true,
  buildings: [{ id: '11111111-1111-4111-8111-111111111111', name: 'Zeno House Đào Duy Anh' }],
  roleOptions: [{ value: 'manager' as const, label: 'Quản lý' }],
  defaultRole: 'manager' as const,
  busy: false,
}

async function fill(wrapper: ReturnType<typeof mount>, label: string, value: string) {
  await wrapper.get(`input[data-label="${label}"]`).setValue(value)
}

describe('UserCreateModal', () => {
  it('shows field errors and does not submit invalid input', async () => {
    const wrapper = mount(UserCreateModal, { props, global: { stubs } })
    await wrapper.get('form').trigger('submit')

    expect(wrapper.find('[data-error="Email"]').exists()).toBe(true)
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('submits a normalized payload with selected buildings', async () => {
    const wrapper = mount(UserCreateModal, { props, global: { stubs } })
    await fill(wrapper, 'Email', 'Linh@Zeno.test')
    await fill(wrapper, 'Mật khẩu', 'Secret#2026')
    await wrapper.get('button[aria-pressed]').trigger('click')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')?.[0]?.[0]).toEqual({
      email: 'linh@zeno.test',
      password: 'Secret#2026',
      role: 'manager',
      building_ids: ['11111111-1111-4111-8111-111111111111'],
    })
  })

  it('shows a server error inside the modal and keeps entered data', async () => {
    const wrapper = mount(UserCreateModal, { props, global: { stubs } })
    await fill(wrapper, 'Email', 'linh@zeno.test')
    expect(wrapper.find('[data-alert]').exists()).toBe(false)

    await wrapper.setProps({ error: 'Email đã tồn tại.' })

    expect(wrapper.get('[data-alert]').text()).toBe('Email đã tồn tại.')
    expect((wrapper.get('input[data-label="Email"]').element as HTMLInputElement).value).toBe('linh@zeno.test')
  })

  it('resets the form each time it opens', async () => {
    const wrapper = mount(UserCreateModal, { props, global: { stubs } })
    await fill(wrapper, 'Email', 'a@b.c')
    await wrapper.setProps({ open: false })
    await wrapper.setProps({ open: true })

    expect((wrapper.get('input[data-label="Email"]').element as HTMLInputElement).value).toBe('')
  })
})
