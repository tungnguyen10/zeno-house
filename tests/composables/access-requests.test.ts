import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const refresh = vi.fn(async () => {})
const fetchMock = vi.hoisted(() => vi.fn())

vi.stubGlobal('$fetch', fetchMock)
vi.stubGlobal('useFetch', vi.fn(() => ({
  data: ref({ data: [] }),
  status: ref('success'),
  error: ref(null),
  refresh,
})))

describe('useAccessRequests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock.mockResolvedValue({ data: {} })
  })

  it('approves and rejects through the request-scoped endpoints then refreshes', async () => {
    const { useAccessRequests } = await import('../../app/composables/useAccessRequests')
    const queue = useAccessRequests()

    await queue.approve('request-1', { role: 'manager', building_ids: ['building-1'] })
    await queue.reject('request-2', { reason: 'Không đủ thông tin xác minh' })

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/access-requests/request-1/approve', {
      method: 'POST',
      body: { role: 'manager', building_ids: ['building-1'] },
    })
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/access-requests/request-2/reject', {
      method: 'POST',
      body: { reason: 'Không đủ thông tin xác minh' },
    })
    expect(refresh).toHaveBeenCalledTimes(2)
  })
})
