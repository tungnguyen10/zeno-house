import { describe, expect, it } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import UserDetailDrawer from '~/components/users/UserDetailDrawer.vue'
import type { ManagedUserWithAssignments } from '~/types/users'

const row: ManagedUserWithAssignments = {
  user: { id: 'u1', email: 'duong@zeno.test', name: 'Nguyễn Tùng Dương', role: 'manager', createdBy: null },
  assignments: [
    { id: 'a1', building_id: 'b1', can_delete_master_data: false, building: { id: 'b1', slug: 's', code: 'nttt', name: 'Nguyễn Thành Tùng', address: '', status: 'active' } },
  ] as never,
}

const UiButton = defineComponent({
  props: ['loading', 'disabled', 'variant'],
  emits: ['click'],
  setup: (props, { slots, emit, attrs }) => () => h('button', { ...attrs, disabled: props.disabled, onClick: () => emit('click') }, slots.default?.()),
})

const stubs = {
  UiDrawer: { props: ['modelValue', 'title'], template: '<div v-if="modelValue"><slot name="header" /><slot /></div>' },
  UiButton,
  UiToggle: defineComponent({ props: ['modelValue', 'label', 'ariaLabel'], emits: ['update:modelValue'], setup: (props, { emit }) => () => h('label', [h('input', { type: 'checkbox', 'data-toggle': '', 'aria-label': props.ariaLabel, checked: props.modelValue, onChange: () => emit('update:modelValue', !props.modelValue) }), props.label]) }),
  UiSelect: defineComponent({ props: ['modelValue', 'options'], emits: ['update:modelValue'], setup: (props, { emit }) => () => h('select', { 'data-assign': '', onChange: (e: Event) => emit('update:modelValue', (e.target as HTMLSelectElement).value) }, (props.options as { value: string; label: string }[]).map(o => h('option', { value: o.value }, o.label))) }),
  UiInput: defineComponent({ props: ['modelValue', 'label'], emits: ['update:modelValue'], setup: (props, { emit }) => () => h('input', { 'data-label': props.label, value: props.modelValue, onInput: (e: Event) => emit('update:modelValue', (e.target as HTMLInputElement).value) }) }),
  UiAlert: { template: '<div role="alert"><slot /></div>' },
  UiBadge: { template: '<span><slot /></span>' },
}

const baseProps = {
  row,
  buildings: [{ id: 'b1', name: 'Nguyễn Thành Tùng' }, { id: 'b2', name: 'Zeno House Phan Tây Hồ' }],
  roleOptions: [{ value: 'owner' as const, label: 'Chủ nhà' }, { value: 'manager' as const, label: 'Quản lý' }],
  canEditRole: false,
  busyKeys: new Set<string>(),
  editing: false,
}

const button = (wrapper: ReturnType<typeof mount>, text: string) =>
  wrapper.findAll('button').find(b => b.text().trim() === text)!

describe('UserDetailDrawer', () => {
  it('does not steal focus from the opener when it closes while editing', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const opener = document.createElement('button')
    host.appendChild(opener)
    const mountPoint = document.createElement('div')
    host.appendChild(mountPoint)
    const wrapper = mount(UserDetailDrawer, {
      attachTo: mountPoint,
      props: { ...baseProps, editing: true, 'onUpdate:editing': (value: boolean) => wrapper.setProps({ editing: value }) },
      global: { stubs: { ...stubs, UiDrawer: { props: ['modelValue'], template: '<div data-drawer :data-open="modelValue"><slot name="header" /><slot /></div>' } } },
    })
    opener.focus()

    await wrapper.setProps({ row: null })
    await flushPromises()

    expect(wrapper.props('editing')).toBe(false)
    expect(button(wrapper, 'Sửa')).toBeTruthy()
    expect(document.activeElement).toBe(opener)
    wrapper.unmount()
    host.remove()
  })

  it('shows only the role as subtitle when the user has no name', () => {
    const nameless = { ...row, user: { ...row.user, name: null } } as ManagedUserWithAssignments
    const wrapper = mount(UserDetailDrawer, { props: { ...baseProps, row: nameless }, global: { stubs } })
    const subtitle = wrapper.get('p.text-xs')

    expect(subtitle.text()).toBe('Quản lý')
    expect(wrapper.get('h2').text()).toBe('duong@zeno.test')
  })

  it('marks a control busy only for its own key', () => {
    const busyKeys = new Set(['unassign:a1'])
    const wrapper = mount(UserDetailDrawer, { props: { ...baseProps, busyKeys }, global: { stubs } })

    expect(wrapper.findAllComponents(UiButton).find(b => b.text() === 'Bỏ gán')!.props('loading')).toBe(true)
    expect(wrapper.findAllComponents(UiButton).find(b => b.text() === 'Gán')!.props('loading')).toBe(false)
  })
  it('keeps rendering the last row while the drawer closes', async () => {
    const wrapper = mount(UserDetailDrawer, { props: baseProps, global: { stubs: { ...stubs, UiDrawer: { props: ['modelValue'], template: '<div data-drawer :data-open="modelValue"><slot name="header" /><slot /></div>' } } } })

    await wrapper.setProps({ row: null })

    expect(wrapper.get('[data-drawer]').attributes('data-open')).toBe('false')
    expect(wrapper.text()).toContain('Nguyễn Tùng Dương')
  })

  it('lists assignments and emits toggle and unassign', async () => {
    const wrapper = mount(UserDetailDrawer, { props: baseProps, global: { stubs } })

    expect(wrapper.text()).toContain('Nguyễn Thành Tùng')
    expect(wrapper.text()).toContain('nttt')
    expect(wrapper.get('[data-toggle]').attributes('aria-label')).toBe('Cho phép xoá dữ liệu ở Nguyễn Thành Tùng')
    expect(wrapper.text()).toContain('Cho phép xoá dữ liệu')
    await wrapper.get('[data-toggle]').trigger('change')
    expect(wrapper.emitted('toggleDelete')).toEqual([['a1', true]])
    await button(wrapper, 'Bỏ gán').trigger('click')
    expect(wrapper.emitted('unassign')).toEqual([['a1']])
  })

  it('names each unassign button after its building', () => {
    const wrapper = mount(UserDetailDrawer, { props: baseProps, global: { stubs } })
    expect(button(wrapper, 'Bỏ gán').attributes('aria-label')).toBe('Bỏ gán Nguyễn Thành Tùng')

    const orphaned = { ...row, assignments: [{ ...row.assignments[0], building: null }] } as unknown as ManagedUserWithAssignments
    const fallback = mount(UserDetailDrawer, { props: { ...baseProps, row: orphaned }, global: { stubs } })
    expect(button(fallback, 'Bỏ gán').attributes('aria-label')).toBe('Bỏ gán tòa nhà này')
  })

  it('offers only unassigned buildings and emits assign', async () => {
    const wrapper = mount(UserDetailDrawer, { props: baseProps, global: { stubs } })
    const select = wrapper.get('[data-assign]')

    expect(select.findAll('option').map(o => o.text())).toEqual(['Chọn tòa nhà…', 'Zeno House Phan Tây Hồ'])
    await select.setValue('b2')
    await wrapper.get('[data-assign-form]').trigger('submit')
    expect(wrapper.emitted('assign')).toEqual([['u1', 'b2']])
  })

  it('requires a second confirmation before emitting remove', async () => {
    const wrapper = mount(UserDetailDrawer, { props: baseProps, global: { stubs } })

    expect(wrapper.text()).toContain('Thu hồi quyền đăng nhập. Không thể hoàn tác.')
    await button(wrapper, 'Xoá').trigger('click')
    expect(wrapper.emitted('remove')).toBeUndefined()
    expect(wrapper.text()).toContain('thu hồi quyền đăng nhập')
    await button(wrapper, 'Xoá vĩnh viễn').trigger('click')
    expect(wrapper.emitted('remove')).toEqual([['u1']])
  })

  it('cancelling the confirmation returns to the initial danger zone', async () => {
    const wrapper = mount(UserDetailDrawer, { props: baseProps, global: { stubs } })

    await button(wrapper, 'Xoá').trigger('click')
    await button(wrapper, 'Huỷ').trigger('click')
    expect(button(wrapper, 'Xoá')).toBeTruthy()
  })

  it('shows a compact login-info row instead of a definition list in view mode', () => {
    const wrapper = mount(UserDetailDrawer, { props: baseProps, global: { stubs } })
    const info = wrapper.get('section[aria-labelledby="user-info-heading"]')

    expect(info.text()).toContain('Thông tin đăng nhập')
    expect(info.text()).toContain('Email, họ tên và mật khẩu')
    expect(info.text()).not.toContain('duong@zeno.test')
    expect(info.find('dl').exists()).toBe(false)
    expect(info.find('form').exists()).toBe(false)
  })

  it('moves focus to the cancel button when asking for delete confirmation', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const wrapper = mount(UserDetailDrawer, { attachTo: host, props: baseProps, global: { stubs } })

    await button(wrapper, 'Xoá').trigger('click')
    await flushPromises()

    expect(document.activeElement?.textContent?.trim()).toBe('Huỷ')
    wrapper.unmount()
    host.remove()
  })

  it('edits inline and omits role when the viewer cannot change roles', async () => {
    const wrapper = mount(UserDetailDrawer, { props: baseProps, global: { stubs } })

    await button(wrapper, 'Sửa').trigger('click')
    expect(wrapper.emitted('update:editing')).toEqual([[true]])
    await wrapper.setProps({ editing: true })
    await wrapper.get('input[data-label="Họ tên"]').setValue('Dương Nguyễn')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('update')).toEqual([['u1', { email: 'duong@zeno.test', full_name: 'Dương Nguyễn' }]])
  })

  it('includes the role when the viewer is admin', async () => {
    const wrapper = mount(UserDetailDrawer, { props: { ...baseProps, canEditRole: true }, global: { stubs } })

    await button(wrapper, 'Sửa').trigger('click')
    await wrapper.setProps({ editing: true })
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('update')?.[0]?.[1]).toMatchObject({ role: 'manager' })
  })

  it('shows a validation message instead of emitting an invalid email', async () => {
    const wrapper = mount(UserDetailDrawer, { props: baseProps, global: { stubs } })

    await button(wrapper, 'Sửa').trigger('click')
    await wrapper.setProps({ editing: true })
    await wrapper.get('input[data-label="Email"]').setValue('not-an-email')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('update')).toBeUndefined()
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
  })
})
