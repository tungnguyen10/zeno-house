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
  template: '<div class="combobox"><slot name="footer" :close="() => {}" :query="\'\'" /></div>',
})
const dialogStub = defineComponent({
  name: 'TenantQuickCreateDialog',
  props: ['open', 'initialName', 'initialPhone', 'linkable'],
  emits: ['created', 'close', 'needs-verify'],
  template: '<div />',
})
const inputStub = defineComponent({
  props: ['modelValue', 'placeholder', 'density', 'ariaLabel'],
  emits: ['update:modelValue'],
  template: '<div><input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" /></div>',
})

const t = (id: string, fullName: string, phone = '0900000000') => ({ id, code: id, fullName, phone, status: 'active' })

const mountPicker = (props: Record<string, unknown>) => mount(TenantPicker, {
  props: { modelValue: null, ...props },
  global: { stubs: { UiCombobox: comboStub, TenantQuickCreateDialog: dialogStub, UiInput: inputStub, IconCheckSmall: true } },
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

describe('TenantPicker — verify a former tenant of another owner', () => {
  const verified = { data: { tenant: { id: 't-old', code: 'KT-OLD', fullName: 'Lê C', phone: '0901234567' }, linkToken: 'tok-1', expiresAt: '2026-11-18T10:10:00.000Z' } }

  function routeFetch(linkResult: () => Promise<unknown>) {
    fetchMock.mockImplementation(async (url: string) => (url === '/api/tenants/link-verify' ? linkResult() : { data: [] }))
  }

  async function verifyWith(w: ReturnType<typeof mount>, proof: string) {
    await w.find('[data-test="tenant-link-proof"] input').setValue(proof)
    await w.find('[data-test="tenant-link-submit"]').trigger('click')
    await flushPromises()
  }

  it('offers verification only for an unmatched phone inside a building context', async () => {
    routeFetch(async () => verified)
    const noBuilding = mountPicker({})
    await typeQuery(noBuilding, '0901234567')
    expect(noBuilding.find('[data-test="tenant-link-verify"]').exists()).toBe(false)

    const w = mountPicker({ buildingId: 'b-1' })
    await typeQuery(w, 'Lê C')
    expect(w.find('[data-test="tenant-link-verify"]').exists()).toBe(false)
    await typeQuery(w, '0901 234 567')
    expect(w.find('[data-test="tenant-link-verify"]').exists()).toBe(true)
    // Inside the popup, so the open list never covers it.
    expect(w.find('.combobox [data-test="tenant-link-verify"]').exists()).toBe(true)
  })

  it('selects the verified tenant and emits its link token', async () => {
    routeFetch(async () => verified)
    const w = mountPicker({ buildingId: 'b-1' })
    await typeQuery(w, '0901 234 567')
    await verifyWith(w, '012345678901')
    expect(fetchMock).toHaveBeenCalledWith('/api/tenants/link-verify', expect.objectContaining({
      method: 'POST', body: { building_id: 'b-1', phone: '0901234567', proof: '012345678901' },
    }))
    expect(w.emitted('update:modelValue')!.at(-1)).toEqual(['t-old'])
    expect(w.emitted('update:linkToken')!.at(-1)).toEqual(['tok-1'])
    expect(w.find('[data-test="tenant-link-verify"]').exists()).toBe(false)
    expect(w.find('[data-test="tenant-link-verified"]').exists()).toBe(true)
  })

  it.each([
    ['TENANT_LINK_UNVERIFIED', 404, 'Không khớp'],
    ['TENANT_BUSY', 409, 'Đang thuê nơi khác'],
    ['TENANT_LINK_DISABLED', 503, 'Chưa bật'],
  ])('shows one short line for %s', async (code, statusCode, text) => {
    routeFetch(async () => { throw { statusCode, data: { error: { code, message: 'server' } } } })
    const w = mountPicker({ buildingId: 'b-1' })
    await typeQuery(w, '0901234567')
    await verifyWith(w, '1')
    expect(w.find('[data-test="tenant-link-error"]').text()).toContain(text)
    expect(w.emitted('update:linkToken')).toBeUndefined()
  })

  it('clears the token when a normal option is chosen', async () => {
    const w = mountPicker({ buildingId: 'b-1' })
    w.findComponent({ name: 'UiCombobox' }).vm.$emit('update:modelValue', t('t-1', 'An'))
    await flushPromises()
    expect(w.emitted('update:linkToken')!.at(-1)).toEqual([null])
  })

  it('drops a verified tenant when the building changes', async () => {
    routeFetch(async () => verified)
    const w = mountPicker({ buildingId: 'b-1' })
    await typeQuery(w, '0901234567')
    await verifyWith(w, '012345678901')
    await w.setProps({ buildingId: 'b-2' })
    await flushPromises()
    expect(w.emitted('update:modelValue')!.at(-1)).toEqual([null])
    expect(w.emitted('update:linkToken')!.at(-1)).toEqual([null])
    expect(w.find('[data-test="tenant-link-stale"]').text()).toContain('xác minh lại')
  })

  it('asks to verify again when a restored tenant is no longer visible', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === '/api/tenants/t-gone') throw { statusCode: 404, data: { error: { code: 'NOT_FOUND' } } }
      return { data: [] }
    })
    const w = mountPicker({ modelValue: 't-gone', buildingId: 'b-1' })
    await flushPromises()
    expect(w.emitted('update:modelValue')!.at(-1)).toEqual([null])
    expect(w.find('[data-test="tenant-link-stale"]').exists()).toBe(true)
  })

  it('opens verification prefilled when quick create hits an identity conflict', async () => {
    const w = mountPicker({ buildingId: 'b-1' })
    w.findComponent({ name: 'TenantQuickCreateDialog' }).vm.$emit('needs-verify', { phone: '0901 234 567', proof: '012345678901' })
    await flushPromises()
    expect(w.findComponent({ name: 'TenantQuickCreateDialog' }).props('open')).toBe(false)
    expect((w.find('[data-test="tenant-link-proof"] input').element as HTMLInputElement).value).toBe('012345678901')
    // The popup is closed at this point, so the row sits below the field instead.
    expect(w.find('.combobox [data-test="tenant-link-verify"]').exists()).toBe(false)
    expect(w.find('[data-test="tenant-link-verify"]').exists()).toBe(true)
  })
})
