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
const UserDetailDrawer = defineComponent({
  name: 'UserDetailDrawer',
  props: ['row', 'buildings', 'roleOptions', 'canEditRole', 'busyKey', 'editing'],
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
  UserCreateModal: true, UserDetailDrawer, UserListRow,
}

beforeEach(() => {
  vi.clearAllMocks()
  users.value = [user('o1', 'Bùi Văn Linh', 'owner'), user('m1', 'Trần Minh', 'manager')]
  Object.assign(auth, { isAdmin: true, canCreateOwner: true, role: 'admin' })
  vi.stubGlobal('definePageMeta', vi.fn())
  vi.stubGlobal('useIntersectionObserver', vi.fn())
  vi.stubGlobal('useAppHeaderTitle', () => ref(null))
  vi.stubGlobal('useAuthStore', () => auth)
  vi.stubGlobal('useToast', () => toast)
  vi.stubGlobal('useManagerAssignments', () => ({
    users, buildings: ref([]), buildingsWithoutManager: ref([]), isLoading: ref(false), error: ref(null), refresh: vi.fn(), ...api,
  }))
})

const mountPage = async () => {
  const wrapper = mount(Page, { global: { stubs } })
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
    api.deleteUser.mockImplementationOnce(async () => { users.value = users.value.filter(u => u.user.id !== 'm1') })
    const wrapper = await mountPage()
    await wrapper.get('[data-row="m1"]').trigger('click')

    wrapper.findComponent({ name: 'UserDetailDrawer' }).vm.$emit('remove', 'm1')
    await flushPromises()

    expect(toast.success).toHaveBeenCalledWith('Đã xoá người dùng.')
    expect(wrapper.get('[data-drawer]').attributes('data-drawer')).toBe('')
  })
})
