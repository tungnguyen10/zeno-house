import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import Page from '~/pages/dashboard/settings/managers.vue'
import type { ManagedUserWithAssignments } from '~/types/users'

const user = (id: string, name: string, role: 'owner' | 'manager'): ManagedUserWithAssignments => ({
  user: { id, email: `${id}@zeno.test`, name, role, createdBy: null },
  assignments: [],
})

const users = ref<ManagedUserWithAssignments[]>([])
const api = {
  createUser: vi.fn(), updateUser: vi.fn(), deleteUser: vi.fn(), assign: vi.fn(), toggle: vi.fn(), unassign: vi.fn(),
}
const toast = { success: vi.fn(), error: vi.fn() }
const auth = { isAdmin: true, canCreateOwner: true, canManageUsers: true, role: 'admin' }

const drawerProps = ref<Record<string, unknown>>({})
const isLoading = ref(false)
const UserCreateModal = defineComponent({
  name: 'UserCreateModal',
  props: ['open', 'error', 'buildings', 'roleOptions', 'defaultRole', 'busy'],
  emits: ['close', 'submit'],
  setup: props => () => h('div', { 'data-create': String(props.open), 'data-create-error': (props.error as string | null) ?? '' }),
})
const UserDetailDrawer = defineComponent({
  name: 'UserDetailDrawer',
  props: ['row', 'buildings', 'roleOptions', 'canEditRole', 'busyKeys', 'editing'],
  emits: ['close', 'update', 'assign', 'toggleDelete', 'unassign', 'remove', 'update:editing'],
  setup(props) {
    return () => {
      drawerProps.value = { ...props }
      return h('div', { 'data-drawer': props.row ? (props.row as ManagedUserWithAssignments).user.id : '' })
    }
  },
})
const UserListRow = defineComponent({
  props: ['row', 'manageable'],
  emits: ['open'],
  setup: (props, { emit }) => () => h('div', {
    'data-row': (props.row as ManagedUserWithAssignments).user.id,
    'data-manageable': String(props.manageable),
    onClick: () => props.manageable && emit('open', (props.row as ManagedUserWithAssignments).user.id),
  }),
})

const stubs = {
  UiPageHeader: { template: '<header><slot /><slot name="actions" /></header>' },
  UiSearchInput: defineComponent({ props: ['modelValue'], emits: ['update:modelValue'], setup: (_, { emit }) => () => h('input', { 'data-search': '', onInput: (e: Event) => emit('update:modelValue', (e.target as HTMLInputElement).value) }) }),
  UiTabs: defineComponent({ props: ['modelValue', 'tabs'], emits: ['update:modelValue'], setup: (props, { emit }) => () => h('div', { 'data-tabs': '' }, (props.tabs as { key: string; label: string }[]).map(t => h('button', { 'data-tab': t.key, onClick: () => emit('update:modelValue', t.key) }, t.label))) }),
  UiAlert: true, UiSkeleton: true, UiEmptyState: { props: ['title'], template: '<p data-empty>{{ title }}</p>' }, IconPlus: true,
  UserCreateModal, UserDetailDrawer, UserListRow,
}

beforeEach(() => {
  vi.clearAllMocks()
  users.value = [user('o1', 'Bùi Văn Linh', 'owner'), user('m1', 'Trần Minh', 'manager')]
  Object.assign(auth, { isAdmin: true, canCreateOwner: true, role: 'admin' })
  isLoading.value = false
  vi.stubGlobal('definePageMeta', vi.fn())
  vi.stubGlobal('useIntersectionObserver', vi.fn())
  vi.stubGlobal('useAppHeaderTitle', () => ref(null))
  vi.stubGlobal('useAuthStore', () => auth)
  vi.stubGlobal('useToast', () => toast)
  vi.stubGlobal('useManagerAssignments', () => ({
    users, buildings: ref([]), buildingsWithoutManager: ref([]), isLoading, error: ref(null), refresh: vi.fn(), ...api,
  }))
})

const mountPage = async (options: { attachTo?: HTMLElement } = {}) => {
  const wrapper = mount(Page, { global: { stubs }, ...options })
  await flushPromises()
  return wrapper
}

describe('settings users page', () => {
  it('filters by search text and by role', async () => {
    const wrapper = await mountPage()

    await wrapper.get('[data-search]').setValue('minh')
    expect(wrapper.findAll('[data-row]').map(r => r.attributes('data-row'))).toEqual(['m1'])

    await wrapper.get('[data-search]').setValue('')
    await wrapper.get('[data-tab="owner"]').trigger('click')
    expect(wrapper.findAll('[data-row]').map(r => r.attributes('data-row'))).toEqual(['o1'])
  })

  it('shows a search empty state when nothing matches', async () => {
    const wrapper = await mountPage()
    await wrapper.get('[data-search]').setValue('không có ai')

    expect(wrapper.get('[data-empty]').text()).toBe('Không tìm thấy người dùng')
  })

  it('keeps the list mounted while a refresh is pending', async () => {
    const wrapper = await mountPage()
    await wrapper.get('[data-row="m1"]').trigger('click')

    isLoading.value = true
    await flushPromises()

    expect(wrapper.find('[data-row="m1"]').exists()).toBe(true)
  })

  it('opens the drawer for the clicked user', async () => {
    const wrapper = await mountPage()
    await wrapper.get('[data-row="m1"]').trigger('click')

    expect(wrapper.get('[data-drawer]').attributes('data-drawer')).toBe('m1')
  })

  it('hides role tabs for owner and makes other owners non-manageable', async () => {
    Object.assign(auth, { isAdmin: false, canCreateOwner: false, role: 'owner' })
    const wrapper = await mountPage()

    expect(wrapper.find('[data-tabs]').exists()).toBe(false)
    expect(wrapper.get('[data-row="o1"]').attributes('data-manageable')).toBe('false')
    expect(wrapper.get('[data-row="m1"]').attributes('data-manageable')).toBe('true')
  })

  it('keeps the drawer open and toasts on a failed unassign', async () => {
    api.unassign.mockRejectedValueOnce(new Error('boom'))
    const wrapper = await mountPage()
    await wrapper.get('[data-row="m1"]').trigger('click')

    wrapper.findComponent({ name: 'UserDetailDrawer' }).vm.$emit('unassign', 'a1')
    await flushPromises()

    expect(toast.error).toHaveBeenCalledWith('Không thể bỏ gán khỏi tòa nhà.')
    expect(wrapper.get('[data-drawer]').attributes('data-drawer')).toBe('m1')
  })

  it('closes the drawer after a successful delete', async () => {
    api.deleteUser.mockResolvedValueOnce(undefined)
    const wrapper = await mountPage()
    await wrapper.get('[data-row="m1"]').trigger('click')

    wrapper.findComponent({ name: 'UserDetailDrawer' }).vm.$emit('remove', 'm1')
    await flushPromises()

    expect(toast.success).toHaveBeenCalledWith('Đã xoá người dùng.')
    expect(wrapper.get('[data-drawer]').attributes('data-drawer')).toBe('')
  })

  it('moves focus to the add button after a successful delete', async () => {
    api.deleteUser.mockResolvedValueOnce(undefined)
    const host = document.createElement('div')
    document.body.appendChild(host)
    const wrapper = await mountPage({ attachTo: host })
    await wrapper.get('[data-row="m1"]').trigger('click')

    wrapper.findComponent({ name: 'UserDetailDrawer' }).vm.$emit('remove', 'm1')
    await flushPromises()

    expect(document.activeElement?.getAttribute('aria-label')).toBe('Thêm người dùng')
    wrapper.unmount()
    host.remove()
  })

  it('permits role edits for admins only', async () => {
    let wrapper = await mountPage()
    expect(drawerProps.value.canEditRole).toBe(true)
    wrapper.unmount()

    Object.assign(auth, { isAdmin: false, canCreateOwner: false, role: 'owner' })
    wrapper = await mountPage()
    expect(drawerProps.value.canEditRole).toBe(false)
  })

  it('keeps the create modal open with an inline error when creating fails', async () => {
    api.createUser.mockRejectedValueOnce(new Error('boom'))
    const wrapper = await mountPage()
    const modal = wrapper.findComponent({ name: 'UserCreateModal' })
    expect(modal.props('open')).toBe(false)

    await wrapper.findAll('button').find(b => b.text().includes('Thêm người dùng'))!.trigger('click')
    expect(modal.props('open')).toBe(true)
    modal.vm.$emit('submit', { email: 'a@b.c', password: 'Secret#2026', role: 'manager', building_ids: [] })
    await flushPromises()

    expect(toast.error).not.toHaveBeenCalled()
    expect(modal.props('open')).toBe(true)
    expect(modal.props('error')).toBe('Không thể tạo người dùng.')
  })

  const openDrawer = async () => {
    const wrapper = await mountPage()
    await wrapper.get('[data-row="m1"]').trigger('click')
    return { wrapper, drawer: wrapper.findComponent({ name: 'UserDetailDrawer' }) }
  }

  it('keeps editing open and toasts when an update fails', async () => {
    api.updateUser.mockRejectedValueOnce(new Error('boom'))
    const { drawer } = await openDrawer()
    drawer.vm.$emit('update:editing', true)
    await flushPromises()
    expect(drawerProps.value.editing).toBe(true)

    drawer.vm.$emit('update', 'm1', { email: 'm1@zeno.test', full_name: 'Trần Minh' })
    await flushPromises()

    expect(toast.error).toHaveBeenCalledWith('Không thể cập nhật người dùng.')
    expect(drawerProps.value.editing).toBe(true)
  })

  it('toasts when an assign fails', async () => {
    api.assign.mockRejectedValueOnce(new Error('boom'))
    const { drawer } = await openDrawer()

    drawer.vm.$emit('assign', 'm1', 'b1')
    await flushPromises()

    expect(toast.error).toHaveBeenCalledWith('Không thể gán vào tòa nhà.')
  })

  it('toasts when a delete-permission toggle fails', async () => {
    api.toggle.mockRejectedValueOnce(new Error('boom'))
    const { drawer } = await openDrawer()

    drawer.vm.$emit('toggleDelete', 'a1', true)
    await flushPromises()

    expect(toast.error).toHaveBeenCalledWith('Không thể cập nhật quyền xoá dữ liệu.')
  })

  it('keeps the drawer open and toasts when a delete fails', async () => {
    api.deleteUser.mockRejectedValueOnce(new Error('boom'))
    const { wrapper, drawer } = await openDrawer()

    drawer.vm.$emit('remove', 'm1')
    await flushPromises()

    expect(toast.error).toHaveBeenCalledWith('Không thể xoá người dùng.')
    expect(wrapper.get('[data-drawer]').attributes('data-drawer')).toBe('m1')
  })

  it('keeps a busy key until its own operation settles', async () => {
    let resolveToggle: () => void = () => {}
    api.toggle.mockReturnValueOnce(new Promise<void>((resolve) => { resolveToggle = resolve }))
    api.unassign.mockReturnValueOnce(new Promise<void>(() => {}))
    const { drawer } = await openDrawer()
    const busyKeys = () => drawerProps.value.busyKeys as Set<string>

    drawer.vm.$emit('toggleDelete', 'a1', true)
    drawer.vm.$emit('unassign', 'a2')
    await flushPromises()
    expect([...busyKeys()].sort()).toEqual(['toggle:a1', 'unassign:a2'])

    resolveToggle()
    await flushPromises()
    expect([...busyKeys()]).toEqual(['unassign:a2'])
  })
})
