import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const useLazyFetch = vi.fn()
vi.stubGlobal('useLazyFetch', useLazyFetch)

const data = ref<{ data: unknown[] } | undefined>(undefined)
const error = ref<unknown>(null)

beforeEach(() => {
  vi.clearAllMocks()
  data.value = undefined
  error.value = null
  useLazyFetch.mockReturnValue({ data, error })
})

const load = () => import('~/composables/useAccessRequestPendingCount')

describe('useAccessRequestPendingCount', () => {
  it('requests only pending items under a dedicated key, client-side', async () => {
    const { useAccessRequestPendingCount, ACCESS_REQUEST_PENDING_COUNT_KEY } = await load()
    useAccessRequestPendingCount(true)

    expect(useLazyFetch).toHaveBeenCalledWith('/api/access-requests', expect.objectContaining({
      key: ACCESS_REQUEST_PENDING_COUNT_KEY,
      query: { status: 'pending' },
      server: false,
      immediate: true,
    }))
  })

  it('does not fetch for users who cannot see the item', async () => {
    const { useAccessRequestPendingCount } = await load()
    const count = useAccessRequestPendingCount(false)

    expect(useLazyFetch).toHaveBeenCalledWith('/api/access-requests', expect.objectContaining({ immediate: false }))
    data.value = { data: [{ id: 'a' }] }
    expect(count.value).toBeNull()
  })

  it('is null while loading and equals the list length when loaded', async () => {
    const { useAccessRequestPendingCount } = await load()
    const count = useAccessRequestPendingCount(true)

    expect(count.value).toBeNull()
    data.value = { data: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] }
    expect(count.value).toBe(3)
  })

  it('is null when the request fails', async () => {
    const { useAccessRequestPendingCount } = await load()
    const count = useAccessRequestPendingCount(true)

    data.value = { data: [{ id: 'a' }] }
    error.value = new Error('forbidden')
    expect(count.value).toBeNull()
  })
})
