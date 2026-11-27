import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { beforeEach, expect, it, vi } from 'vitest'
import Page from '~/pages/dashboard/tenant-support-requests.vue'
import UiTextarea from '~/components/ui/UiTextarea.vue'
import { usePortalUnsavedChanges } from '~/composables/tenant-portal/usePortalUnsavedChanges'

const first = {
  id: 'first', title: 'First fixture', description: 'First full request', tenantLabel: 'Fixture A', tenantCode: 'A',
  createdAt: '2026-11-01T10:00:00.000Z', updatedAt: '2026-11-01T10:00:00.000Z', status: 'new',
  publicResponse: null, respondedAt: null, attachmentSignedUrl: null, attachmentUnavailable: false,
}
const second = { ...first, id: 'second', title: 'Second fixture', tenantCode: 'B' }
const updateStatus = vi.fn()
const refresh = vi.fn()
const actionError = ref<string | null>(null)
const routeGuard = vi.fn()
const stubs = {
  UiTable: defineComponent({ props: ['rows'], setup(props, { slots }) { return () => h('div', props.rows.map((row: unknown) => slots['cell-actions']?.({ row }))) } }),
  UiDrawer: defineComponent({ props: ['modelValue'], emits: ['update:modelValue'], setup(props, { slots, emit }) { return () => props.modelValue ? h('div', { role: 'dialog' }, [h('button', { 'data-close': '', onClick: () => emit('update:modelValue', false) }, 'Close'), slots.default?.(), slots.footer?.()]) : null } }),
  UiButton: defineComponent({ setup(_, { slots, attrs }) { return () => h('button', attrs, slots.default?.()) } }),
  UiConfirmModal: { props: ['open', 'title'], emits: ['confirm', 'cancel'], template: '<aside v-if="open" aria-label="Discard confirmation">{{title}}<button @click="$emit(\'confirm\')">Bỏ bản nháp</button><button @click="$emit(\'cancel\')">Tiếp tục soạn</button></aside>' },
  UiAlert: { template: '<aside><slot /></aside>' },
  UiListToolbar: true, UiPagination: true, UiBadge: true, NuxtLink: true, UiSelect: true,
  UiTextarea,
}

beforeEach(() => {
  vi.clearAllMocks()
  actionError.value = null
  vi.stubGlobal('definePageMeta', vi.fn())
  vi.stubGlobal('onBeforeRouteLeave', routeGuard)
  vi.stubGlobal('usePortalUnsavedChanges', usePortalUnsavedChanges)
  vi.stubGlobal('useAuthStore', () => ({ can: () => true }))
  vi.stubGlobal('useTenantSupportRequestQueue', () => ({
    selectedStatus: ref(''), page: ref(1), requests: ref([first, second]),
    meta: ref({ totalPages: 1, total: 2 }), status: ref('success'), error: ref(null),
    refresh, updating: ref(false), actionError, updateStatus,
  }))
})

it('saves an explicit public reply with the displayed request version and confirms it', async () => {
  updateStatus.mockResolvedValue({ ...first, status: 'in_progress', publicResponse: 'We will visit tomorrow.', respondedAt: '2026-11-02T10:00:00.000Z' })
  const wrapper = mount(Page, { global: { stubs } })
  await wrapper.findAll('button').find(button => button.text() === 'Xem')!.trigger('click')
  await wrapper.get('textarea').setValue('We will visit tomorrow.')
  expect(wrapper.get('textarea').attributes('maxlength')).toBe('4000')
  expect(wrapper.text()).toContain('Không nhập ghi chú nội bộ')
  await wrapper.findAll('button').find(button => button.text() === 'Lưu phản hồi')!.trigger('click')
  await flushPromises()
  expect(updateStatus).toHaveBeenCalledWith(first, 'in_progress', 'We will visit tomorrow.')
  expect(wrapper.text()).toContain('Đã lưu phản hồi gửi người thuê')
  await wrapper.get('[data-close]').trigger('click')
  await flushPromises()
  expect(wrapper.find('[aria-label="Discard confirmation"]').exists()).toBe(false)
  expect(wrapper.find('textarea').exists()).toBe(false)
  wrapper.unmount()
})

it('asks before switching away from an unsaved public response', async () => {
  const wrapper = mount(Page, { global: { stubs } })
  const views = () => wrapper.findAll('button').filter(button => button.text() === 'Xem')
  await views()[0]!.trigger('click')
  await wrapper.get('textarea').setValue('Unsaved response')
  await views()[1]!.trigger('click')
  expect(wrapper.text()).toContain('Bỏ phản hồi đang soạn?')
  expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('Unsaved response')
  await wrapper.findAll('button').find(button => button.text() === 'Tiếp tục soạn')!.trigger('click')
  await flushPromises()
  expect(wrapper.get('[role="dialog"]').text()).toContain('First full request')
  await views()[1]!.trigger('click')
  await wrapper.findAll('button').find(button => button.text() === 'Bỏ bản nháp')!.trigger('click')
  await flushPromises()
  expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('')
  expect(wrapper.get('[role="dialog"]').text()).toContain('Second fixture')
  expect(updateStatus).not.toHaveBeenCalled()
  wrapper.unmount()
})

it('preserves the response after a stale conflict and asks before discarding it to reload', async () => {
  updateStatus.mockImplementation(async () => { actionError.value = 'Yêu cầu đã được cập nhật. Tải lại danh sách.'; return null })
  const wrapper = mount(Page, { global: { stubs } })
  await wrapper.findAll('button').find(button => button.text() === 'Xem')!.trigger('click')
  await wrapper.get('textarea').setValue('Keep my draft after conflict')
  await wrapper.findAll('button').find(button => button.text() === 'Lưu phản hồi')!.trigger('click')
  await flushPromises()
  expect(wrapper.text()).toContain('Yêu cầu đã được cập nhật.')
  expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('Keep my draft after conflict')
  await wrapper.findAll('button').find(button => button.text() === 'Tải lại danh sách')!.trigger('click')
  expect(refresh).not.toHaveBeenCalled()
  await wrapper.findAll('button').find(button => button.text() === 'Tiếp tục soạn')!.trigger('click')
  await flushPromises()
  expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('Keep my draft after conflict')
  expect(refresh).not.toHaveBeenCalled()
  wrapper.unmount()
})

it('protects navigation away from a response draft', async () => {
  const wrapper = mount(Page, { global: { stubs } })
  await wrapper.findAll('button').find(button => button.text() === 'Xem')!.trigger('click')
  await wrapper.get('textarea').setValue('Draft protected on navigation')
  const leave = routeGuard.mock.calls[0]![0]() as Promise<boolean>
  await flushPromises()
  expect(wrapper.text()).toContain('Bỏ phản hồi đang soạn?')
  await wrapper.findAll('button').find(button => button.text() === 'Tiếp tục soạn')!.trigger('click')
  await expect(leave).resolves.toBe(false)
  wrapper.unmount()
})
