import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readonly, ref } from 'vue'
import type { BuildingContractProfile } from '~/types/building-contract-profile'
import { buildingContractProfileSchema } from '~/utils/validators/building-contract-profile'

const fetchMock = vi.hoisted(() => vi.fn())
vi.stubGlobal('$fetch', fetchMock)

const savedProfile: BuildingContractProfile = {
  buildingId: 'b-1', lessorFullName: 'Nguyễn An', lessorDateOfBirth: '1990-01-01',
  lessorPermanentAddress: '123 Lê Lợi', lessorIdNumber: '012345678901',
  lessorIdIssuedDate: '2020-01-01', lessorIdIssuedPlace: 'Hà Nội', lessorPhone: '0901234567',
  lessorIdentityMasked: false, brandName: null, defaultTermMonths: 12, defaultDepositMonths: 0,
  noticeDays: 0, depositRefundDays: 0, renewalMonths: 0, extraOccupantFee: 0, drillingFee: 0,
  fingerprintResetFee: 0, signedCopies: 2, copiesPerParty: 1, updatedAt: '2026-01-01T00:00:00Z', updatedBy: null,
}
const input = buildingContractProfileSchema.parse({ lessor_full_name: 'Nguyễn An', default_deposit_months: 0 })

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

beforeEach(() => {
  fetchMock.mockReset()
  window.localStorage.clear()
})

describe('useBuildingContractProfile', () => {
  it('PUTs JSON to the current encoded identifier, updates source, then awaits readiness refresh', async () => {
    const request = deferred<{ data: BuildingContractProfile }>()
    const refresh = deferred<undefined>()
    fetchMock.mockReturnValue(request.promise)
    const data = ref<BuildingContractProfile | null>(null)
    const sourceData = readonly(data)
    const set = vi.fn((profile: BuildingContractProfile) => { data.value = profile })
    const onSaved = vi.fn(() => {
      expect(data.value).toEqual(savedProfile)
      return refresh.promise
    })
    const identifier = ref('old')
    const { useBuildingContractProfile } = await import('~/composables/buildings/useBuildingContractProfile')
    const form = useBuildingContractProfile(identifier, { data: sourceData, set, onSaved })
    expect(form.profile).toBe(sourceData)
    expect(form.saving.value).toBe(false)
    expect(form.error.value).toBeNull()

    identifier.value = 'zeno /1'
    const pending = form.save(input)
    expect(form.saving.value).toBe(true)
    expect(set).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledWith('/api/buildings/zeno%20%2F1/contract-profile', expect.objectContaining({ method: 'PUT', body: input }))
    expect(fetchMock.mock.calls[0]![1].body.default_deposit_months).toBe(0)

    request.resolve({ data: savedProfile })
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledOnce())
    expect(set).toHaveBeenCalledExactlyOnceWith(savedProfile)
    expect(form.profile.value).toEqual(savedProfile)
    expect(form.saving.value).toBe(true)
    refresh.resolve(undefined)
    await expect(pending).resolves.toEqual(savedProfile)
    expect(form.saving.value).toBe(false)
    expect(form.error.value).toBeNull()
    expect(window.localStorage.length).toBe(0)
  })

  it('exposes standardized errors, rethrows the cause, and clears the error before retry', async () => {
    const cause = { data: { error: { code: 'FORBIDDEN', message: 'Không có quyền' } } }
    fetchMock.mockRejectedValueOnce(cause)
    const set = vi.fn()
    const onSaved = vi.fn(async () => {})
    const { useBuildingContractProfile } = await import('~/composables/buildings/useBuildingContractProfile')
    const form = useBuildingContractProfile('zeno', { data: ref(null), set, onSaved })
    await expect(form.save(input)).rejects.toBe(cause)
    expect(form.error.value).toBe('Không có quyền')
    expect(form.saving.value).toBe(false)
    expect(set).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()

    const retry = deferred<{ data: BuildingContractProfile }>()
    fetchMock.mockReturnValueOnce(retry.promise)
    const pending = form.save(input)
    expect(form.error.value).toBeNull()
    expect(form.saving.value).toBe(true)
    retry.resolve({ data: savedProfile })
    await pending
    expect(form.saving.value).toBe(false)
    expect(onSaved).toHaveBeenCalledOnce()
  })

  it('uses safe fallback copy instead of exposing a raw error containing PII', async () => {
    const cause = new Error(`Failed to save ${savedProfile.lessorIdNumber}`)
    fetchMock.mockRejectedValueOnce(cause)
    const { useBuildingContractProfile } = await import('~/composables/buildings/useBuildingContractProfile')
    const form = useBuildingContractProfile('zeno', { data: ref(null), set: vi.fn() })
    await expect(form.save(input)).rejects.toBe(cause)
    expect(form.error.value).toBe('Không thể lưu thông tin hợp đồng. Vui lòng thử lại.')
    expect(form.saving.value).toBe(false)
    expect(window.localStorage.length).toBe(0)
  })

  it('cleans up loading when readiness refresh fails after the profile was saved', async () => {
    fetchMock.mockResolvedValueOnce({ data: savedProfile })
    const cause = new Error('Readiness unavailable')
    const set = vi.fn()
    const onSaved = vi.fn(async () => { throw cause })
    const { useBuildingContractProfile } = await import('~/composables/buildings/useBuildingContractProfile')
    const form = useBuildingContractProfile('zeno', { data: ref(null), set, onSaved })
    await expect(form.save(input)).rejects.toBe(cause)
    expect(set).toHaveBeenCalledWith(savedProfile)
    expect(form.error.value).toBe('Không thể lưu thông tin hợp đồng. Vui lòng thử lại.')
    expect(form.saving.value).toBe(false)
  })

  it('saves without an optional readiness callback', async () => {
    fetchMock.mockResolvedValueOnce({ data: savedProfile })
    const set = vi.fn()
    const { useBuildingContractProfile } = await import('~/composables/buildings/useBuildingContractProfile')
    const form = useBuildingContractProfile('zeno', { data: ref(null), set })
    await expect(form.save(input)).resolves.toEqual(savedProfile)
    expect(set).toHaveBeenCalledWith(savedProfile)
    expect(form.saving.value).toBe(false)
  })
})
