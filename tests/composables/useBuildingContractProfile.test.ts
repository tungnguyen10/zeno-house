import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const fetchMock = vi.hoisted(() => vi.fn())
vi.stubGlobal('$fetch', fetchMock)

beforeEach(() => vi.clearAllMocks())

describe('useBuildingContractProfile', () => {
  it('PUTs JSON, updates the source and refreshes readiness', async () => {
    fetchMock.mockResolvedValue({ data: { buildingId: 'b-1' } })
    const set = vi.fn()
    const onSaved = vi.fn(async () => {})
    const { useBuildingContractProfile } = await import('~/composables/buildings/useBuildingContractProfile')
    const { save } = useBuildingContractProfile('zeno', { data: ref(null), set, onSaved })

    await save({ lessor_full_name: 'A' } as never)

    expect(fetchMock).toHaveBeenCalledWith('/api/buildings/zeno/contract-profile', expect.objectContaining({ method: 'PUT', body: { lessor_full_name: 'A' } }))
    expect(set).toHaveBeenCalledWith({ buildingId: 'b-1' })
    expect(onSaved).toHaveBeenCalled()
  })

  it('exposes a standardized error and rethrows', async () => {
    fetchMock.mockRejectedValue({ data: { error: { message: 'Không có quyền' } } })
    const { useBuildingContractProfile } = await import('~/composables/buildings/useBuildingContractProfile')
    const { save, error } = useBuildingContractProfile('zeno', { data: ref(null), set: vi.fn() })
    await expect(save({} as never)).rejects.toBeTruthy()
    expect(error.value).toBeTruthy()
  })

  it('PATCHes only the provided fields', async () => {
    fetchMock.mockResolvedValue({ data: { buildingId: 'b-1' } })
    const set = vi.fn()
    const { useBuildingContractProfile } = await import('~/composables/buildings/useBuildingContractProfile')
    const { patch } = useBuildingContractProfile('zeno', { data: ref(null), set })

    await patch({ notice_days: 30 })

    expect(fetchMock).toHaveBeenCalledWith('/api/buildings/zeno/contract-profile', expect.objectContaining({ method: 'PATCH', body: { notice_days: 30 } }))
    expect(set).toHaveBeenCalledWith({ buildingId: 'b-1' })
  })
})
