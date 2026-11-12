import { mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EditPage from '~/pages/portal/profile/edit.vue'

const original = { id: 'fixture', fullName: 'Khách Giả Lập', phone: '0900000000', occupation: null, emergencyContactName: null, emergencyContactPhone: null, idNumber: 'FAKE0001', notes: 'PRIVATE' }
const profile = ref({ ...original })
const saving = ref(false)
const apiError = ref<string | null>(null)
const save = vi.fn(async () => false)
const allowNextLeave = vi.fn()
const navigate = vi.fn()
const toastSuccess = vi.fn()
const stubs = {
  NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
  PortalCard: { template: '<section><slot /></section>' },
  PortalButton: { props: ['disabled', 'loading', 'type'], template: '<button :type="type || \'button\'" :disabled="disabled || loading"><slot /></button>' },
  PortalBottomSheet: { template: '<div />' },
  PortalSkeleton: true,
  PortalEmptyState: true,
  PortalInput: { props: ['modelValue', 'label', 'error', 'disabled'], emits: ['update:modelValue', 'blur'], template: '<label>{{label}}<input :data-label="label" :value="modelValue" :disabled="disabled" @input="$emit(\'update:modelValue\', $event.target.value)" @blur="$emit(\'blur\')"/><span>{{error}}</span></label>' },
}

beforeEach(() => {
  vi.clearAllMocks()
  profile.value = { ...original }
  saving.value = false
  apiError.value = null
  save.mockResolvedValue(false)
  vi.stubGlobal('definePageMeta', () => {})
  vi.stubGlobal('onBeforeRouteLeave', vi.fn())
  vi.stubGlobal('navigateTo', navigate)
  vi.stubGlobal('usePortalChrome', () => ({ setChrome: vi.fn() }))
  vi.stubGlobal('usePortalToast', () => ({ success: toastSuccess }))
  vi.stubGlobal('usePortalProfile', () => ({ profile, status: ref('success'), error: ref(null), refresh: vi.fn(), save, saving, fieldErrors: ref({}), apiError }))
  vi.stubGlobal('usePortalUnsavedChanges', () => ({ discardOpen: ref(false), guardRouteLeave: vi.fn(), onBeforeUnload: vi.fn(), onDiscardSheetUpdate: vi.fn(), allowNextLeave, keepEditing: vi.fn(), discardChanges: vi.fn() }))
})

describe('four-field profile edit interaction', () => {
  it('only mounts four inputs, keeps legal/internal data out, and disables unchanged save', () => {
    const wrapper = mount(EditPage, { global: { stubs } })
    expect(wrapper.findAll('input')).toHaveLength(4)
    expect(wrapper.text()).not.toContain('PRIVATE')
    expect(wrapper.html()).not.toContain('FAKE0001')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('a').attributes('href')).toBe('/portal/requests?intent=profile-correction')
    wrapper.unmount()
  })

  it('preserves unsaved contact edits across profile refresh and a rejected save', async () => {
    const wrapper = mount(EditPage, { global: { stubs } })
    await wrapper.get('[data-label="Nghề nghiệp"]').setValue('Công việc giả lập')
    profile.value = { ...original, occupation: 'Server refreshed' }
    await nextTick()
    expect((wrapper.get('[data-label="Nghề nghiệp"]').element as HTMLInputElement).value).toBe('Công việc giả lập')
    await wrapper.get('form').trigger('submit')
    expect(save).toHaveBeenCalledWith({ occupation: 'Công việc giả lập' })
    expect(allowNextLeave).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
    expect((wrapper.get('[data-label="Nghề nghiệp"]').element as HTMLInputElement).value).toBe('Công việc giả lập')
    wrapper.unmount()
  })

  it('normalizes contact changes and navigates only after confirmed save', async () => {
    save.mockResolvedValue(true)
    const wrapper = mount(EditPage, { global: { stubs } })
    await wrapper.get('[data-label="Số điện thoại"]').setValue('+84 90 000 0001')
    await wrapper.get('form').trigger('submit')
    expect(save).toHaveBeenCalledWith({ phone: '0900000001' })
    expect(allowNextLeave).toHaveBeenCalledOnce()
    expect(navigate).toHaveBeenCalledWith('/portal/profile')
    expect(toastSuccess).toHaveBeenCalledWith('Đã cập nhật thông tin liên hệ.')
    wrapper.unmount()
  })

  it('retains generic conflicts as a banner and disables all fields while saving', () => {
    apiError.value = 'Không thể tạo hồ sơ với thông tin này; liên hệ quản trị viên'
    saving.value = true
    const wrapper = mount(EditPage, { global: { stubs } })
    expect(wrapper.get('[role="alert"]').text()).toBe(apiError.value)
    expect(wrapper.findAll('input').every(input => input.attributes('disabled') !== undefined)).toBe(true)
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
})
