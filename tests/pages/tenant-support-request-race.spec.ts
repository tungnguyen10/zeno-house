import { mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { expect, it, vi } from 'vitest'
import Page from '~/pages/dashboard/tenant-support-requests.vue'

it('prevents switching requests while a status write is in flight', async () => {
  const first = { id: 'first', title: 'First fixture', tenantLabel: 'Fixture A', tenantCode: 'A', createdAt: '2026-01-01', status: 'new' }
  const second = { ...first, id: 'second', title: 'Second fixture', tenantCode: 'B' }
  const updating = ref(false)
  let finish!: (value: unknown) => void
  vi.stubGlobal('definePageMeta', vi.fn())
  vi.stubGlobal('useAuthStore', () => ({ can: () => true }))
  vi.stubGlobal('useTenantSupportRequestQueue', () => ({
    selectedStatus: ref(''), page: ref(1), requests: ref([first, second]),
    meta: ref({ totalPages: 1, total: 2 }), status: ref('success'), error: ref(null),
    refresh: vi.fn(), updating, actionError: ref(null),
    updateStatus: () => { updating.value = true; return new Promise(resolve => { finish = resolve }) },
  }))
  const wrapper = mount(Page, { global: { stubs: {
    UiTable: defineComponent({ props: ['rows'], setup(props, { slots }) { return () => h('div', props.rows.map((row: unknown) => slots['cell-actions']?.({ row }))) } }),
    UiDrawer: defineComponent({ props: ['modelValue'], emits: ['update:modelValue'], setup(props, { slots, emit }) { return () => props.modelValue ? h('div', [h('button', { 'data-close': '', onClick: () => emit('update:modelValue', false) }, 'Close'), slots.default?.(), slots.footer?.()]) : null } }),
    UiButton: defineComponent({ setup(_, { slots, attrs }) { return () => h('button', attrs, slots.default?.()) } }),
    UiListToolbar: true, UiPagination: true, UiBadge: true, UiAlert: true, NuxtLink: true,
  } } })
  const views = () => wrapper.findAll('button').filter(button => button.text() === 'Xem')
  await views()[0]!.trigger('click')
  await wrapper.findAll('button').find(button => button.text() === 'Bắt đầu xử lý')!.trigger('click')
  await wrapper.find('[data-close]').trigger('click')
  expect(views()[1]!.attributes('disabled')).toBeDefined()
  finish({ ...first, status: 'in_progress' })
  updating.value = false
  wrapper.unmount()
})
