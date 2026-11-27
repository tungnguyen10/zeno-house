import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import UserCreateModal from '~/components/users/UserCreateModal.vue'
import UiCheckboxReal from '~/components/ui/UiCheckbox.vue'

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
  UiCheckbox: defineComponent({
    props: ['modelValue', 'label'],
    emits: ['update:modelValue'],
    setup: (props, { emit }) => () => h('label', [
      h('input', { type: 'checkbox', 'data-building': props.label, checked: props.modelValue, onChange: (e: Event) => emit('update:modelValue', (e.target as HTMLInputElement).checked) }),
      props.label,
    ]),
  }),
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
    await wrapper.get('input[data-building="Zeno House Đào Duy Anh"]').setValue(true)
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')?.[0]?.[0]).toEqual({
      email: 'linh@zeno.test',
      password: 'Secret#2026',
      role: 'manager',
      building_ids: ['11111111-1111-4111-8111-111111111111'],
    })
  })

  it('labels the optional fields and lists buildings in a scrollable checkbox box', () => {
    const wrapper = mount(UserCreateModal, { props, global: { stubs } })

    expect(wrapper.find('input[data-label="Họ tên (tuỳ chọn)"]').exists()).toBe(true)
    expect(wrapper.get('legend').text()).toBe('Tòa nhà phụ trách (tuỳ chọn)')
    expect(wrapper.get('fieldset .max-h-48').classes()).toContain('overflow-y-auto')
    expect(wrapper.find('button[aria-pressed]').exists()).toBe(false)
  })

  it('gives each building checkbox label a 44px hit area below sm', () => {
    const wrapper = mount(UserCreateModal, { props, global: { stubs: { ...stubs, UiCheckbox: UiCheckboxReal, IconCheckSmall: true } } })
    const label = wrapper.get('fieldset label')

    expect(label.classes()).toEqual(expect.arrayContaining(['min-h-11', 'items-center', 'sm:min-h-0']))
    expect(label.element.parentElement!.parentElement!.className).not.toContain('min-h-11')
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
