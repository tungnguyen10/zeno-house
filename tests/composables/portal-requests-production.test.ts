import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { usePortalRequests } from '~/composables/tenant-portal/usePortalRequests'
import { usePortalSessionKey } from '~/composables/tenant-portal/usePortalSessionKey'
import type { TenantSupportRequest } from '~/types/tenant-portal'
import type { TenantSupportRequestPage } from '~/types/tenant-support-requests'

const upload = vi.hoisted(() => vi.fn())
vi.mock('~/utils/upload', () => ({ uploadWithProgress: upload }))
const fetchApi = vi.fn()
const refreshPage = vi.fn(async () => {})
const session = ref({ id: 'tenant-a' })
const request: TenantSupportRequest = {
  id: 'request-1', tenantId: 'tenant-a', buildingId: 'building-1', contractId: 'contract-1',
  title: 'Help', description: 'Details', status: 'new', attachmentSignedUrl: null, attachmentUnavailable: false,
  publicResponse: null, respondedAt: null, createdAt: '2026-11-01T10:00:00.000Z', updatedAt: '2026-11-01T10:00:00.000Z',
}
const firstPage = ref<TenantSupportRequestPage>({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } })
const useFetchMock = vi.fn(() => ({ data: firstPage, status: ref('success'), error: ref(null), refresh: refreshPage }))
let wrapper: VueWrapper | undefined

function setup() {
  let result!: ReturnType<typeof usePortalRequests>
  wrapper = mount(defineComponent({ setup() { result = usePortalRequests(); return () => h('div') } }))
  return result
}

beforeEach(() => {
  vi.clearAllMocks()
  session.value = { id: 'tenant-a' }
  firstPage.value = { data: [request], meta: { total: 21, page: 1, limit: 20, totalPages: 2 } }
  vi.stubGlobal('useSupabaseUser', () => session)
  vi.stubGlobal('usePortalSessionKey', usePortalSessionKey)
  vi.stubGlobal('useFetch', useFetchMock)
  vi.stubGlobal('apiFetch', fetchApi)
})
afterEach(() => { wrapper?.unmount(); wrapper = undefined })

describe('tenant request pagination and session isolation', () => {
  it('keys private history by account and appends the next exact-count page', async () => {
    fetchApi.mockResolvedValue({ data: [{ ...request, id: 'request-21' }], meta: { total: 21, page: 2, limit: 20, totalPages: 2 } })
    const state = setup()
    expect(state.sessionKey.value).toBe('portal-tenant-a-requests')
    expect(useFetchMock).toHaveBeenCalledWith('/api/tenant/requests', expect.objectContaining({ query: { page: 1, limit: 20 }, key: state.sessionKey }))
    expect(state.hasMore.value).toBe(true)
    await state.loadMore()
    expect(fetchApi).toHaveBeenCalledWith('/api/tenant/requests', { query: { page: 2, limit: 20 } })
    expect(state.requests.value.map(row => row.id)).toEqual(['request-1', 'request-21'])
    expect(state.hasMore.value).toBe(false)
    await state.refresh()
    expect(state.requests.value.map(row => row.id)).toEqual(['request-1'])
    expect(state.hasMore.value).toBe(true)
  })

  it('keeps previous history and permits a retry when an older page fails', async () => {
    fetchApi.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: [{ ...request, id: 'request-21' }] })
    const state = setup()
    await state.loadMore()
    expect(state.requests.value).toEqual([request])
    expect(state.loadMoreError.value).toContain('Không tải được yêu cầu cũ')
    expect(state.hasMore.value).toBe(true)
    await state.loadMore()
    expect(state.requests.value).toHaveLength(2)
    expect(state.loadMoreError.value).toBeNull()
  })

  it('ignores a pending history page after refresh or a session change', async () => {
    let finish!: (value: unknown) => void
    fetchApi.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const state = setup()
    const pending = state.loadMore()
    await state.refresh()
    finish({ data: [{ ...request, id: 'late-old-page' }] })
    await pending
    expect(state.requests.value.map(row => row.id)).toEqual(['request-1'])
    const previousSession = state.loadMore()
    session.value = { id: 'tenant-b' }
    firstPage.value = { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }
    finish({ data: [{ ...request, id: 'private-old-account' }] })
    await previousSession
    expect(state.requests.value).toEqual([])
    expect(state.loadingMore.value).toBe(false)
  })

  it('does not return an old account detail after identity changes', async () => {
    let finish!: (value: unknown) => void
    fetchApi.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const state = setup()
    const pending = state.loadDetail('request-1')
    session.value = { id: 'tenant-b' }
    finish({ data: request })
    await expect(pending).resolves.toBeNull()
  })
})

describe('tenant request evidence submission', () => {
  it('uses measured progress, disables retries and prevents concurrent duplicate creates', async () => {
    let finish!: (value: unknown) => void
    upload.mockImplementation((_url, _form, options) => {
      options.onProgress(43)
      return new Promise(resolve => { finish = resolve })
    })
    const state = setup()
    const input = { title: 'Check evidence', description: 'Details', attachment: new File(['proof'], 'proof.pdf', { type: 'application/pdf' }) }
    const pending = state.submit(input)
    expect(state.progress.value).toBe(43)
    expect(state.submitting.value).toBe(true)
    await expect(state.submit(input)).resolves.toBe(false)
    expect(upload).toHaveBeenCalledTimes(1)
    expect(upload.mock.calls[0]![2]).toMatchObject({ retries: 0, signal: expect.any(AbortSignal), onProgress: expect.any(Function) })
    finish({ data: request })
    await expect(pending).resolves.toBe(true)
    expect(refreshPage).toHaveBeenCalledTimes(1)
    expect(state.submitting.value).toBe(false)
  })

  it('aborts the upload and suppresses old-session feedback and refresh', async () => {
    let finish!: (value: unknown) => void
    upload.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const state = setup()
    const pending = state.submit({ title: 'Private request', description: 'Details', attachment: new File(['proof'], 'proof.pdf', { type: 'application/pdf' }) })
    const signal = upload.mock.calls[0]![2].signal as AbortSignal
    session.value = { id: 'tenant-b' }
    expect(signal.aborted).toBe(true)
    expect(state.submitting.value).toBe(false)
    finish({ data: request })
    await expect(pending).resolves.toBe(false)
    expect(state.apiError.value).toBeNull()
    expect(refreshPage).not.toHaveBeenCalled()
  })

  it('cancels an in-flight evidence upload when leaving the page', async () => {
    let finish!: (value: unknown) => void
    upload.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const state = setup()
    const pending = state.submit({ title: 'Private request', description: 'Details', attachment: new File(['proof'], 'proof.pdf', { type: 'application/pdf' }) })
    const signal = upload.mock.calls[0]![2].signal as AbortSignal
    wrapper!.unmount()
    wrapper = undefined
    expect(signal.aborted).toBe(true)
    finish({ data: request })
    await expect(pending).resolves.toBe(false)
    await nextTick()
    expect(refreshPage).not.toHaveBeenCalled()
  })
})
