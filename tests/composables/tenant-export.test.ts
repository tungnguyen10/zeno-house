import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTenantExport } from '../../app/composables/tenants/useTenantExport'

const fetchMock = vi.hoisted(() => vi.fn())
const downloadMock = vi.hoisted(() => vi.fn())
vi.stubGlobal('$fetch', fetchMock)
vi.mock('../../app/composables/useExportDownload', () => ({
  useExportDownload: () => ({ downloadBlob: downloadMock }),
}))

const buildingId = '0a8a4dd0-7d6f-4f4e-bc7e-3c5e1b833333'
const otherBuildingId = '0a8a4dd0-7d6f-4f4e-bc7e-3c5e1b844444'

beforeEach(() => {
  vi.clearAllMocks()
  fetchMock.mockImplementation(async (url: string) => {
    if (url === '/api/buildings') return { data: [{ id: buildingId, name: 'Tòa A' }], meta: { totalPages: 1 } }
    return { data: [
      { id: 't-1', code: 'A1', fullName: 'Nguyễn Văn A', phone: '0901', roomNumbers: ['101'], roles: ['primary'] },
      { id: 't-2', code: 'B1', fullName: 'Trần Thị B', phone: '0902', roomNumbers: ['102'], roles: ['roommate'] },
    ] }
  })
})

describe('useTenantExport', () => {
  it('keeps chosen tenants across search and selects all matching results', async () => {
    const state = useTenantExport()
    await state.changeBuilding(buildingId)
    state.toggleSelected('t-1')
    state.search.value = 'Trần'
    state.toggleAllFiltered()
    expect(state.selectedIds.value).toEqual(['t-1', 't-2'])
    state.toggleAllFiltered()
    expect(state.selectedIds.value).toEqual(['t-1'])
  })

  it('clears selections and candidates when the building changes', async () => {
    const state = useTenantExport()
    await state.changeBuilding(buildingId)
    state.toggleSelected('t-1')
    await state.changeBuilding(otherBuildingId)
    expect(state.selectedIds.value).toEqual([])
    expect(state.search.value).toBe('')
    expect(fetchMock).toHaveBeenLastCalledWith('/api/tenants/export-candidates', { query: { building_id: otherBuildingId } })
  })

  it('downloads only selected IDs through POST', async () => {
    const state = useTenantExport()
    await state.changeBuilding(buildingId)
    state.toggleSelected('t-2')
    await state.exportSelected()
    expect(downloadMock).toHaveBeenCalledWith('/api/tenants/export', 'tenants.xlsx', {
      method: 'POST', body: { building_id: buildingId, tenant_ids: ['t-2'] },
    })
  })

  it('finds Vietnamese names without accents including Đ', async () => {
    fetchMock.mockImplementation(async (url: string) => url === '/api/buildings'
      ? { data: [], meta: { totalPages: 1 } }
      : { data: [{ id: 't-3', code: 'D1', fullName: 'Đỗ Thị Dung', phone: '0903', roomNumbers: ['103'], roles: ['primary'] }] })
    const state = useTenantExport()
    await state.changeBuilding(buildingId)
    state.search.value = 'do thi'
    expect(state.filteredCandidates.value.map(row => row.id)).toEqual(['t-3'])
  })

  it('refreshes candidates and clears selection when occupants changed before export', async () => {
    const state = useTenantExport()
    await state.changeBuilding(buildingId)
    state.toggleSelected('t-1')
    fetchMock.mockClear()
    downloadMock.mockRejectedValue({ data: { error: {
      message: 'Danh sách khách đang ở đã thay đổi. Vui lòng chọn lại khách cần xuất.',
      details: { reason: 'TENANT_EXPORT_SELECTION_STALE' },
    } } })

    expect(await state.exportSelected()).toBe(false)
    expect(state.selectedIds.value).toEqual([])
    expect(state.error.value).toContain('Vui lòng chọn lại')
    expect(fetchMock).toHaveBeenCalledWith('/api/tenants/export-candidates', { query: { building_id: buildingId } })
  })
})
