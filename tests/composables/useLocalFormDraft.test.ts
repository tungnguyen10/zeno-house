import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { useTenantForm } from '~/composables/tenants/useTenantForm'
import { TENANT_SENSITIVE_DRAFT_KEYS } from '~/utils/tenant-identity'
import { useLocalFormDraft } from '~/composables/useLocalFormDraft'

interface Form {
  name: string
  count: number
}

afterEach(() => {
  vi.useRealTimers()
  window.localStorage.clear()
})

describe('useLocalFormDraft', () => {
  it('reports hasDraft and restores a legacy plain value', () => {
    window.localStorage.setItem('form:a', JSON.stringify({ name: 'Zeno', count: 2 }))
    const formData = ref<Form>({ name: '', count: 0 })

    const draft = useLocalFormDraft<Form>({ key: 'form:a', formData })

    expect(draft.hasDraft.value).toBe(true)
    expect(draft.draftSavedAt.value).toBe('')
    expect(draft.restoreDraft()).toEqual({ name: 'Zeno', count: 2 })
    expect(formData.value).toEqual({ name: 'Zeno', count: 2 })
  })

  it('restores an envelope value and exposes savedAt', () => {
    window.localStorage.setItem(
      'form:b',
      JSON.stringify({ savedAt: '2026-07-09T00:00:00.000Z', data: { name: 'Env', count: 5 } }),
    )
    const formData = ref<Form>({ name: '', count: 0 })

    const draft = useLocalFormDraft<Form>({ key: 'form:b', formData, envelope: true })

    expect(draft.hasDraft.value).toBe(true)
    expect(draft.draftSavedAt.value).toBe('2026-07-09T00:00:00.000Z')
    expect(draft.restoreDraft()).toEqual({ name: 'Env', count: 5 })
  })

  it('clearDraft removes the stored value and flips hasDraft', () => {
    window.localStorage.setItem('form:c', JSON.stringify({ name: 'X', count: 1 }))
    const draft = useLocalFormDraft<Form>({ key: 'form:c' })

    expect(draft.hasDraft.value).toBe(true)
    draft.clearDraft()
    expect(window.localStorage.getItem('form:c')).toBeNull()
    expect(draft.hasDraft.value).toBe(false)
  })

  it('is inert when the key is null', () => {
    const draft = useLocalFormDraft<Form>({ key: null })
    expect(draft.hasDraft.value).toBe(false)
    expect(draft.restoreDraft()).toBeNull()
  })

  it('computes isDirty from the snapshot', () => {
    const formData = ref<Form>({ name: 'A', count: 1 })
    const snapshot = ref<Form | null>({ name: 'A', count: 1 })
    const draft = useLocalFormDraft<Form>({ key: 'form:d', formData, initialSnapshot: snapshot })

    expect(draft.isDirty.value).toBe(false)
    formData.value = { name: 'B', count: 1 }
    expect(draft.isDirty.value).toBe(true)
  })
})

interface IdentityForm {
  full_name: string
  id_number: string
}

describe('useLocalFormDraft omitKeys', () => {
  it('never writes omitted keys', async () => {
    vi.useFakeTimers()
    const formData = ref<IdentityForm>({ full_name: '', id_number: '' })
    const snapshot = ref<IdentityForm | null>({ full_name: '', id_number: '' })
    useLocalFormDraft<IdentityForm>({ key: 'form:omit', formData, initialSnapshot: snapshot, omitKeys: ['id_number'], debounceMs: 10 })
    formData.value = { full_name: 'Khách Giả Lập', id_number: '012345678901' }
    await nextTick()
    await vi.advanceTimersByTimeAsync(20)
    expect(window.localStorage.getItem('form:omit')).toBe(JSON.stringify({ full_name: 'Khách Giả Lập' }))
    vi.useRealTimers()
  })

  it('purges omitted keys from a legacy draft and keeps current values on restore', () => {
    window.localStorage.setItem('form:legacy', JSON.stringify({ full_name: 'Khách Giả Lập', id_number: '012345678901' }))
    const formData = ref<IdentityForm>({ full_name: '', id_number: '' })
    const draft = useLocalFormDraft<IdentityForm>({ key: 'form:legacy', formData, omitKeys: ['id_number'] })
    expect(window.localStorage.getItem('form:legacy')).not.toContain('012345678901')
    draft.restoreDraft()
    expect(formData.value).toEqual({ full_name: 'Khách Giả Lập', id_number: '' })
  })
})

describe('useLocalFormDraft identity draft lifecycle', () => {
  it('purges envelope drafts while preserving their timestamp and safe fields', () => {
    const savedAt = '2026-11-09T00:00:00.000Z'
    window.localStorage.setItem('form:private-envelope', JSON.stringify({ savedAt, data: { full_name: 'Khách Giả Lập', id_number: '012345678901' } }))
    const formData = ref<IdentityForm>({ full_name: '', id_number: 'current' })
    const draft = useLocalFormDraft({ key: 'form:private-envelope', formData, omitKeys: ['id_number'], envelope: true })
    expect(JSON.parse(window.localStorage.getItem('form:private-envelope')!)).toEqual({ savedAt, data: { full_name: 'Khách Giả Lập' } })
    expect(draft.draftSavedAt.value).toBe(savedAt)
    expect(draft.restoreDraft()).toEqual({ full_name: 'Khách Giả Lập' })
    expect(formData.value.id_number).toBe('current')
  })

  it('purges a legacy draft when the reactive storage key changes', async () => {
    const key = ref<string | null>(null)
    const draft = useLocalFormDraft<IdentityForm>({ key, omitKeys: ['id_number'] })
    window.localStorage.setItem('form:later', JSON.stringify({ full_name: 'Khách Giả Lập', id_number: '012345678901' }))
    key.value = 'form:later'
    await nextTick()
    expect(draft.hasDraft.value).toBe(true)
    expect(JSON.parse(window.localStorage.getItem('form:later')!)).toEqual({ full_name: 'Khách Giả Lập' })
  })

  it('purges a draft written externally before restoring it', () => {
    const formData = ref<IdentityForm>({ full_name: '', id_number: '' })
    const draft = useLocalFormDraft({ key: 'form:external', formData, omitKeys: ['id_number'] })
    window.localStorage.setItem('form:external', JSON.stringify({ full_name: 'Khách Giả Lập', id_number: '012345678901' }))
    draft.restoreDraft()
    expect(JSON.parse(window.localStorage.getItem('form:external')!)).toEqual({ full_name: 'Khách Giả Lập' })
    expect(formData.value).toEqual({ full_name: 'Khách Giả Lập', id_number: '' })
  })
})

describe('useTenantForm identity draft policy', () => {
  it('purges every sensitive tenant field and only restores safe values', () => {
    const sensitive = Object.fromEntries(TENANT_SENSITIVE_DRAFT_KEYS.map(key => [key, `private-${key}`]))
    window.localStorage.setItem('tenant-form:create', JSON.stringify({ full_name: 'Khách Giả Lập', phone: '0900000000', ...sensitive }))
    const current = Object.fromEntries(TENANT_SENSITIVE_DRAFT_KEYS.map(key => [key, '']))
    const formData = ref({ full_name: '', phone: '', ...current })
    const draft = useTenantForm({ draftKey: { mode: 'create' }, formData })
    expect(JSON.parse(window.localStorage.getItem('tenant-form:create')!)).toEqual({ full_name: 'Khách Giả Lập', phone: '0900000000' })
    draft.restoreDraft()
    expect(formData.value).toEqual({ full_name: 'Khách Giả Lập', phone: '0900000000', ...current })
  })
})
