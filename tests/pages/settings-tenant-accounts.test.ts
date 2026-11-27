import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import Page from '~/pages/dashboard/settings/tenant-accounts.vue'

const accounts = ref([
  { tenantId: 't1', tenantName: 'Hoàng Lam Thi', tenantCode: 'hlt-2026-0001', email: 'thyy1280@gmail.com', health: 'linked', status: 'active' },
  { tenantId: 't2', tenantName: 'Nguyễn Tuấn Anh', tenantCode: 'nta-2026-0001', email: 'tuan.anh@gmail.com', health: 'linked', status: 'active' },
])
const orphans = ref<unknown[]>([])
const setStatus = vi.fn()
const toast = { success: vi.fn(), error: vi.fn() }

const UiTable = defineComponent({
  props: ['rows', 'emptyTitle'],
  setup: (props, { slots }) => () => h('div', [
    ...(props.rows as Record<string, unknown>[]).map(row => h('div', { 'data-row': row.tenantId }, [slots['cell-tenant']?.({ row }), slots['cell-actions']?.({ row })])),
    (props.rows as unknown[]).length === 0 ? h('p', { 'data-empty': '' }, props.emptyTitle as string) : null,
  ]),
})

const stubs = {
  UiPageHeader: { template: '<header><slot /><slot name="actions" /></header>' },
  UiTable,
  UiSearchInput: defineComponent({ props: ['modelValue'], emits: ['update:modelValue'], setup: (_, { emit }) => () => h('input', { 'data-search': '', onInput: (e: Event) => emit('update:modelValue', (e.target as HTMLInputElement).value) }) }),
  UiDropdownMenu: { template: '<div data-menu><slot /></div>' },
  UiDropdownMenuItem: defineComponent({ emits: ['click'], setup: (_, { slots, emit }) => () => h('button', { 'data-item': '', onClick: () => emit('click') }, slots.default?.()) }),
  UiStatusBadge: true, UiAlert: true, UiSkeleton: true, UiEmptyState: true, UiModal: true, UiConfirmModal: true, UiCombobox: true, UiInput: true,
  IconPlus: true, IconCheckCircle: true,
}

beforeEach(() => {
  vi.clearAllMocks()
  orphans.value = []
  vi.stubGlobal('definePageMeta', vi.fn())
  vi.stubGlobal('useIntersectionObserver', vi.fn())
  vi.stubGlobal('useAppHeaderTitle', () => ref(null))
  vi.stubGlobal('useToast', () => toast)
  vi.stubGlobal('useAuthStore', () => ({ can: () => true }))
  vi.stubGlobal('useTenantAccounts', () => ({
    accounts, status: ref('success'), error: ref(null), orphans, orphansLoading: ref(false), orphansError: ref(null),
    loadOrphans: vi.fn(), provision: vi.fn(), setStatus, resetPassword: vi.fn(), revoke: vi.fn(), reconcileOrphan: vi.fn(),
  }))
})

const mountPage = async () => {
  const wrapper = mount(Page, { global: { stubs } })
  await flushPromises()
  return wrapper
}

describe('tenant accounts page', () => {
  it('filters by name, code or email', async () => {
    const wrapper = await mountPage()
    await wrapper.get('[data-search]').setValue('nta-2026')

    expect(wrapper.findAll('[data-row]').map(r => r.attributes('data-row'))).toEqual(['t2'])
    await wrapper.get('[data-search]').setValue('zzz')
    expect(wrapper.get('[data-empty]').text()).toBe('Không tìm thấy tài khoản')
  })

  it('puts every row action in the menu with the agreed wording', async () => {
    const wrapper = await mountPage()
    const items = wrapper.get('[data-row="t1"]').findAll('[data-item]').map(i => i.text())

    expect(items).toEqual(['Khoá', 'Đặt lại mật khẩu', 'Gỡ quyền truy cập'])
  })

  it('uses a specific fallback when locking fails', async () => {
    setStatus.mockRejectedValueOnce(new Error())
    const wrapper = await mountPage()
    await wrapper.get('[data-row="t1"]').findAll('[data-item]')[0]!.trigger('click')
    await flushPromises()

    expect(toast.error).toHaveBeenCalledWith('Không thể khoá tài khoản.')
  })

  it('collapses a clean orphan check into one status line', async () => {
    const wrapper = await mountPage()

    expect(wrapper.text()).toContain('Không có tài khoản Auth mồ côi')
    expect(wrapper.text()).not.toContain('Mọi tài khoản tenant hiện có đều đang được liên kết')
  })
})
