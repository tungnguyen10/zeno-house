import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

const fetchMock = vi.hoisted(() => vi.fn())
const clearNuxtDataMock = vi.hoisted(() => vi.fn())
vi.stubGlobal('$fetch', fetchMock)
vi.stubGlobal('clearNuxtData', clearNuxtDataMock)

interface ContractFormShape {
  room_id: string
  tenant_id: string
  start_date: string
  end_date: string
  monthly_rent: string
}

function baseForm(): ContractFormShape {
  return {
    room_id: '11111111-1111-4111-8111-111111111111',
    tenant_id: '22222222-2222-4222-8222-222222222222',
    start_date: '2026-06-01',
    end_date: '2027-06-01',
    monthly_rent: '3000000',
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
})

describe('useContractForm - dirty + draft persistence', () => {
  it('isDirty becomes true when form data changes', async () => {
    const { useContractForm } = await import('../../app/composables/contracts/useContractForm')
    const formData = ref<ContractFormShape>(baseForm())
    const { isDirty } = useContractForm<ContractFormShape>({
      draftKey: { mode: 'create' },
      formData,
      initialSnapshot: { ...formData.value },
    })

    formData.value = { ...formData.value, monthly_rent: '3500000' }
    expect(isDirty.value).toBe(true)
  })

  it('autosaves draft envelope with wizard state after debounce', async () => {
    vi.useFakeTimers()
    const { useContractForm } = await import('../../app/composables/contracts/useContractForm')
    const formData = ref<ContractFormShape>(baseForm())
    const currentStep = ref(1)
    const pendingOccupants = ref<unknown[]>([])
    const selectedServices = ref<unknown[]>([])

    useContractForm<ContractFormShape>({
      draftKey: { mode: 'create' },
      formData,
      initialSnapshot: { ...formData.value },
      wizardState: { currentStep, pendingOccupants, selectedServices },
    })

    currentStep.value = 2
    pendingOccupants.value = [{ tenant_id: 't-2' }]
    formData.value = { ...formData.value, monthly_rent: '4200000' }
    await nextTick()
    vi.advanceTimersByTime(600)
    await nextTick()

    const stored = JSON.parse(window.localStorage.getItem('contract-form:create')!)
    expect(stored).toMatchObject({
      draftVersion: 1,
      data: { monthly_rent: '4200000' },
      wizardState: { currentStep: 2, pendingOccupants: [{ tenant_id: 't-2' }] },
    })
    vi.useRealTimers()
  })

  it('restoreDraft restores form data and wizard state', async () => {
    window.localStorage.setItem('contract-form:create', JSON.stringify({
      draftVersion: 1,
      savedAt: '2026-06-29T00:00:00.000Z',
      data: { ...baseForm(), monthly_rent: '5000000' },
      wizardState: { currentStep: 2, pendingOccupants: [{ tenant_id: 't-9' }], selectedServices: [{ service_id: 's-1' }] },
    }))
    const { useContractForm } = await import('../../app/composables/contracts/useContractForm')
    const formData = ref<ContractFormShape>(baseForm())
    const currentStep = ref(1)
    const pendingOccupants = ref<unknown[]>([])
    const selectedServices = ref<unknown[]>([])
    const { hasDraft, restoreDraft } = useContractForm<ContractFormShape>({
      draftKey: { mode: 'create' },
      formData,
      initialSnapshot: { ...formData.value },
      wizardState: { currentStep, pendingOccupants, selectedServices },
    })

    expect(hasDraft.value).toBe(true)
    restoreDraft()
    expect(formData.value.monthly_rent).toBe('5000000')
    expect(currentStep.value).toBe(2)
    expect(pendingOccupants.value).toEqual([{ tenant_id: 't-9' }])
    expect(selectedServices.value).toEqual([{ service_id: 's-1' }])
  })

  it('detects draft version mismatch and does not overwrite data', async () => {
    window.localStorage.setItem('contract-form:create', JSON.stringify({
      draftVersion: 999,
      savedAt: '2026-06-29T00:00:00.000Z',
      data: { ...baseForm(), monthly_rent: '9999999' },
    }))
    const { useContractForm } = await import('../../app/composables/contracts/useContractForm')
    const formData = ref<ContractFormShape>(baseForm())
    const { isDraftVersionMismatch, draftError, restoreDraft } = useContractForm<ContractFormShape>({
      draftKey: { mode: 'create' },
      formData,
      initialSnapshot: { ...formData.value },
    })

    expect(isDraftVersionMismatch.value).toBe(true)
    expect(restoreDraft()).toBeNull()
    expect(formData.value.monthly_rent).toBe('3000000')
    expect(draftError.value).toContain('Bản nháp cũ không tương thích')
  })

  it('clearDraft removes localStorage entry', async () => {
    window.localStorage.setItem('contract-form:edit:c-1', JSON.stringify({ draftVersion: 1, savedAt: '', data: baseForm() }))
    const { useContractForm } = await import('../../app/composables/contracts/useContractForm')
    const { hasDraft, clearDraft } = useContractForm<ContractFormShape>({
      draftKey: { mode: 'edit', id: 'c-1' },
      formData: ref(baseForm()),
      initialSnapshot: baseForm(),
    })

    expect(hasDraft.value).toBe(true)
    clearDraft()
    expect(window.localStorage.getItem('contract-form:edit:c-1')).toBeNull()
    expect(hasDraft.value).toBe(false)
  })
})

describe('useContractBulkActions', () => {
  it('runAction posts selected ids, returns result, and keeps selection until caller clears', async () => {
    fetchMock.mockResolvedValue({ data: { succeeded: ['a'], failed: [{ id: 'b', reason: 'ACTIVE_CONTRACT' }] } })
    const { useContractBulkActions } = await import('../../app/composables/contracts/useContractBulkActions')
    const { selectedIds, selectAll, runAction } = useContractBulkActions()

    selectAll(['a', 'b'])
    const result = await runAction('delete', { reason: 'cleanup' })

    expect(result).toEqual({ succeeded: ['a'], failed: [{ id: 'b', reason: 'ACTIVE_CONTRACT' }] })
    expect(selectedIds.value).toEqual(['a', 'b'])
    expect(fetchMock).toHaveBeenCalledWith('/api/contracts/bulk', expect.objectContaining({
      method: 'POST',
      body: { action: 'delete', ids: ['a', 'b'], reason: 'cleanup' },
    }))
  })
})

describe('useContractList helpers', () => {
  it('invalidateContractListCache clears contract list async data key', async () => {
    const { invalidateContractListCache, CONTRACT_LIST_ASYNC_KEY } = await import('../../app/composables/contracts/useContractList')

    invalidateContractListCache()

    expect(clearNuxtDataMock).toHaveBeenCalledWith(CONTRACT_LIST_ASYNC_KEY)
  })
})
