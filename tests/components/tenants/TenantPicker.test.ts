import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import TenantPicker from '~/components/tenants/TenantPicker.vue'

const fetchMock = vi.hoisted(() => vi.fn())
const can = vi.hoisted(() => vi.fn())
vi.stubGlobal('$fetch', fetchMock)
vi.mock('~/stores/auth', () => ({ useAuthStore: () => ({ can }) }))

const comboStub = defineComponent({
  name: 'UiCombobox',
  props: ['modelValue', 'options', 'optionKey', 'optionLabel', 'label', 'remoteSearch', 'allowCustom', 'createOption', 'customOptionLabel', 'loading', 'disabled', 'required', 'error', 'id', 'placeholder', 'searchPlaceholder', 'emptyMessage'],
  emits: ['search', 'update:modelValue'],
  template: '<div class="combobox" />',
})
const dialogStub = defineComponent({
  name: 'TenantQuickCreateDialog',
  props: ['open', 'initialName', 'initialPhone'],
  emits: ['created', 'close'],
  template: '<div />',
})

const t = (id: string, fullName: string, phone = '0900000000') => ({ id, code: id, fullName, phone, status: 'active' })

const mountPicker = (props: Record<string, unknown>) => mount(TenantPicker, {
  props: { modelValue: null, ...props },
  global: { stubs: { UiCombobox: comboStub, TenantQuickCreateDialog: dialogStub } },
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  can.mockReturnValue(true)
  fetchMock.mockResolvedValue({ data: [t('t-1', 'An'), t('t-2', 'Bình')] })
})

async function typeQuery(w: ReturnType<typeof mount>, q: string) {
  w.findComponent({ name: 'UiCombobox' }).vm.$emit('search', q)
  vi.advanceTimersByTime(260)
  await flushPromises()
}

describe('TenantPicker', () => {
  it('searches server-side with debounce and excludes ids', async () => {
    const w = mountPicker({ excludeTenantIds: ['t-2'] })
    await typeQuery(w, 'an')
    expect(fetchMock).toHaveBeenCalledWith('/api/tenants', expect.objectContaining({ query: expect.objectContaining({ q: 'an', available: true, limit: 20 }) }))
    expect(w.findComponent({ name: 'UiCombobox' }).props('options').map((o: { id: string }) => o.id)).toEqual(['t-1'])
  })

  it('hides quick create without tenants.create', async () => {
    can.mockReturnValue(false)
    const w = mountPicker({})
    expect(w.findComponent({ name: 'UiCombobox' }).props('allowCustom')).toBe(false)
  })

  it('opens dialog with phone prefilled for phone-like query', async () => {
    const w = mountPicker({})
    const combo = w.findComponent({ name: 'UiCombobox' })
    const option = combo.props('createOption')('0901 234 567')
    combo.vm.$emit('update:modelValue', option)
    await flushPromises()
    const dialog = w.findComponent({ name: 'TenantQuickCreateDialog' })
    expect(dialog.props()).toMatchObject({ open: true, initialPhone: '0901 234 567', initialName: '' })
  })

  it('opens dialog with name prefilled otherwise and selects created tenant', async () => {
    const w = mountPicker({})
    const combo = w.findComponent({ name: 'UiCombobox' })
    combo.vm.$emit('update:modelValue', combo.props('createOption')('Nguyễn Văn A'))
    await flushPromises()
    const dialog = w.findComponent({ name: 'TenantQuickCreateDialog' })
    expect(dialog.props('initialName')).toBe('Nguyễn Văn A')
    dialog.vm.$emit('created', { id: 't-9', code: 'c', fullName: 'Nguyễn Văn A', phone: '0901234567' })
    await flushPromises()
    expect(w.emitted('update:modelValue')!.at(-1)).toEqual(['t-9'])
    expect(w.emitted('selected')!.at(-1)![0]).toMatchObject({ id: 't-9' })
  })

  it('loads summary for a preset id not in results (draft restore)', async () => {
    fetchMock.mockImplementation(async (url: string) => (url === '/api/tenants/t-7' ? { data: t('t-7', 'Chi') } : { data: [] }))
    const w = mountPicker({ modelValue: 't-7' })
    await flushPromises()
    expect(w.findComponent({ name: 'UiCombobox' }).props('modelValue')).toMatchObject({ id: 't-7', fullName: 'Chi' })
  })
})
