import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref, nextTick } from 'vue'
import { useTenantSupportRequestQueue } from '~/composables/useTenantSupportRequestQueue'
import type { OperatorTenantSupportRequest } from '~/types/tenant-support-requests'
const fetchMock = vi.fn()
const refresh = vi.fn()
vi.stubGlobal('apiFetch', fetchMock)
vi.stubGlobal('useFetch', () => ({ data: ref({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } }), status: ref('success'), error: ref(null), refresh }))
const request = { id: 'request-1', status: 'in_progress' } as OperatorTenantSupportRequest
beforeEach(() => { vi.clearAllMocks() })
describe('staff request workflow', () => {
  it('submits expected status to the dedicated endpoint without changing profile state', async () => {
    fetchMock.mockResolvedValue({ data: { ...request, status: 'resolved' } })
    const queue = useTenantSupportRequestQueue()
    expect((await queue.updateStatus(request, 'resolved'))?.status).toBe('resolved')
    expect(fetchMock).toHaveBeenCalledWith('/api/tenant-support-requests/request-1', { method: 'PATCH', body: { status: 'resolved', expected_status: 'in_progress' } })
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(queue.updating.value).toBe(false)
  })
  it('surfaces stale conflict safely and leaves the selected status unchanged', async () => {
    fetchMock.mockRejectedValue({ data: { error: { code: 'CONFLICT', message: 'raw database message' } } })
    const queue = useTenantSupportRequestQueue()
    expect(await queue.updateStatus(request, 'resolved')).toBeNull()
    expect(queue.actionError.value).toContain('Tải lại danh sách')
    expect(queue.actionError.value).not.toContain('raw database')
    expect(request.status).toBe('in_progress')
  })
  it('resets pagination when a status filter changes', async () => {
    const queue = useTenantSupportRequestQueue()
    queue.page.value = 4
    queue.selectedStatus.value = 'new'
    await nextTick()
    expect(queue.page.value).toBe(1)
  })
})
