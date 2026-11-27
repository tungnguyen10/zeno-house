import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import type { ApiSuccess } from '~/types/api'
import type { TenantDocument, TenantPortalBootstrap, TenantProfile } from '~/types/tenant-portal'
import type { UploadOptions } from '~/utils/upload'
import { usePortalProfile } from '~/composables/tenant-portal/usePortalProfile'
import { usePortalDocuments } from '~/composables/tenant-portal/usePortalDocuments'
import { usePortalSessionKey } from '~/composables/tenant-portal/usePortalSessionKey'

const uploadMock = vi.hoisted(() => vi.fn())
vi.mock('~/utils/upload', () => ({ uploadWithProgress: uploadMock }))
const fetchMock = vi.fn()
const refreshBootstrap = vi.fn(async () => {})
const refreshDocuments = vi.fn(async () => {})
const user = ref<{ sub: string } | null>({ sub: 'tenant-a' })
const bootstrap = ref<ApiSuccess<TenantPortalBootstrap>>()
const documentData = ref<ApiSuccess<TenantDocument[]>>({ data: [] })

vi.stubGlobal('$fetch', fetchMock)
vi.stubGlobal('useSupabaseUser', () => user)
vi.stubGlobal('usePortalSessionKey', usePortalSessionKey)
vi.stubGlobal('useFetch', (url: string) => ({
  // Model the same reactive Nuxt data ref changing to the current account's
  // payload while an earlier account's mutation promise is still pending.
  data: url === '/api/tenant/bootstrap' ? bootstrap : documentData,
  status: ref('success'),
  error: ref(null),
  refresh: url === '/api/tenant/bootstrap' ? refreshBootstrap : refreshDocuments,
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function profileFor(id: string): TenantProfile {
  return {
    id,
    code: `FIXTURE-${id}`,
    status: 'active',
    fullName: `Khách giả lập ${id}`,
    phone: '0900000000',
    email: `${id}@example.test`,
    gender: null,
    dateOfBirth: null,
    occupation: null,
    permanentAddress: null,
    idNumber: `IDENTITY-${id}`,
    idIssuedDate: null,
    idIssuedPlace: null,
    emergencyContactName: null,
    emergencyContactPhone: null,
  }
}

function bootstrapFor(id: string): ApiSuccess<TenantPortalBootstrap> {
  return {
    data: {
      profile: profileFor(id),
      contract: null,
      contractAmendments: [],
      invoices: [],
      invoiceMeta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      financialSummary: { outstandingAmount: 0, outstandingCount: 0, overdueAmount: 0, overdueCount: 0, nextInvoice: null },
    },
  }
}

function documentFor(id: string, createdAt = '2026-11-27T10:00:00Z'): TenantDocument {
  return { id, name: `${id}.pdf`, mimeType: 'application/pdf', size: 10, createdAt, signedUrl: `https://example.test/private/${id}` }
}

describe('profile and document mutation account isolation', () => {
  let scope: ReturnType<typeof effectScope>

  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock.mockReset()
    uploadMock.mockReset()
    user.value = { sub: 'tenant-a' }
    bootstrap.value = bootstrapFor('tenant-a')
    documentData.value = { data: [documentFor('a-original')] }
    scope = effectScope()
  })

  afterEach(() => scope.stop())

  it('discards a delayed profile save success after an account switch', async () => {
    const request = deferred<ApiSuccess<TenantProfile>>()
    fetchMock.mockReturnValueOnce(request.promise) // Deliberately ignores abort.
    const form = scope.run(() => usePortalProfile())!
    const saving = form.save({ phone: '0900000001' })
    const signal = fetchMock.mock.calls[0]![1].signal as AbortSignal
    expect(form.profile.value?.phone).toBe('0900000001')

    user.value = { sub: 'tenant-b' }
    bootstrap.value = bootstrapFor('tenant-b')
    expect(signal.aborted).toBe(true)
    expect(form.saving.value).toBe(false)
    request.resolve({ data: { ...profileFor('tenant-a'), phone: '0900000001' } })

    await expect(saving).resolves.toBe(false)
    expect(form.profile.value).toEqual(profileFor('tenant-b'))
    expect(form.apiError.value).toBeNull()
  })

  it('does not roll back B or clear B saving state when a delayed A save fails', async () => {
    const first = deferred<ApiSuccess<TenantProfile>>()
    const second = deferred<ApiSuccess<TenantProfile>>()
    fetchMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const form = scope.run(() => usePortalProfile())!
    const savingA = form.save({ phone: '0900000001' })
    user.value = { sub: 'tenant-b' }
    bootstrap.value = bootstrapFor('tenant-b')
    const savingB = form.save({ phone: '0900000002' })

    first.reject({ data: { error: { message: 'Private validation for A', details: { phone: ['Private field error'] } } } })
    await expect(savingA).resolves.toBe(false)
    expect(form.profile.value).toMatchObject({ id: 'tenant-b', phone: '0900000002' })
    expect(form.saving.value).toBe(true)
    expect(form.apiError.value).toBeNull()
    expect(form.fieldErrors.value).toEqual({})

    second.resolve({ data: { ...profileFor('tenant-b'), phone: '0900000002' } })
    await expect(savingB).resolves.toBe(true)
    expect(form.saving.value).toBe(false)
  })

  it('invalidates the prior generation even when the account changes A to B to A', async () => {
    const request = deferred<ApiSuccess<TenantProfile>>()
    fetchMock.mockReturnValueOnce(request.promise)
    const form = scope.run(() => usePortalProfile())!
    const saving = form.save({ occupation: 'Bản nháp cũ' })
    user.value = { sub: 'tenant-b' }
    user.value = { sub: 'tenant-a' }
    bootstrap.value = bootstrapFor('tenant-a')
    request.resolve({ data: { ...profileFor('tenant-a'), occupation: 'Bản nháp cũ' } })

    await expect(saving).resolves.toBe(false)
    expect(form.profile.value?.occupation).toBeNull()
  })

  it('keeps a refreshed bootstrap authoritative when an older save later fails', async () => {
    const request = deferred<ApiSuccess<TenantProfile>>()
    fetchMock.mockReturnValueOnce(request.promise)
    const form = scope.run(() => usePortalProfile())!
    const saving = form.save({ phone: '0900000001' })
    await form.refresh()
    bootstrap.value = bootstrapFor('tenant-a')
    bootstrap.value.data.profile!.phone = '0900000003'
    bootstrap.value.data.financialSummary.outstandingAmount = 123000
    request.reject(new Error('Old request failure'))

    await expect(saving).resolves.toBe(false)
    expect(refreshBootstrap).toHaveBeenCalledOnce()
    expect(form.profile.value?.phone).toBe('0900000003')
    expect(bootstrap.value.data.financialSummary.outstandingAmount).toBe(123000)
    expect(form.apiError.value).toBeNull()
  })

  it('rolls back only its own optimistic profile while retaining newer invoice data', async () => {
    const request = deferred<ApiSuccess<TenantProfile>>()
    fetchMock.mockReturnValueOnce(request.promise)
    const form = scope.run(() => usePortalProfile())!
    const saving = form.save({ phone: '0900000001' })
    bootstrap.value!.data.financialSummary.outstandingAmount = 456000
    request.reject(new Error('Current request failure'))

    await expect(saving).resolves.toBe(false)
    expect(form.profile.value?.phone).toBe('0900000000')
    expect(bootstrap.value!.data.financialSummary.outstandingAmount).toBe(456000)
    expect(form.apiError.value).toBeTruthy()
  })

  it('never returns A document data or progress into B after a delayed upload', async () => {
    const first = deferred<ApiSuccess<TenantDocument>>()
    const second = deferred<ApiSuccess<TenantDocument>>()
    uploadMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const docs = scope.run(() => usePortalDocuments())!
    const uploadingA = docs.upload(new File(['A'], 'a.pdf', { type: 'application/pdf' }))
    const optionsA = uploadMock.mock.calls[0]![2] as UploadOptions
    const cancelledA = expect(uploadingA).rejects.toMatchObject({ name: 'AbortError' })
    expect(optionsA.retries).toBe(0)
    optionsA.onProgress?.(42)
    expect(docs.progress.value).toBe(42)

    user.value = { sub: 'tenant-b' }
    documentData.value = { data: [documentFor('b-original')] }
    expect(optionsA.signal?.aborted).toBe(true)
    expect(docs.progress.value).toBe(0)
    const uploadingB = docs.upload(new File(['B'], 'b.pdf', { type: 'application/pdf' }))
    const optionsB = uploadMock.mock.calls[1]![2] as UploadOptions
    optionsB.onProgress?.(25)
    optionsA.onProgress?.(100)
    first.resolve({ data: documentFor('a-private') })
    await cancelledA

    expect(docs.documents.value.map(document => document.id)).toEqual(['b-original'])
    expect(docs.uploading.value).toBe(true)
    expect(docs.progress.value).toBe(25)
    second.resolve({ data: documentFor('b-new') })
    await expect(uploadingB).resolves.toEqual(documentFor('b-new'))
    expect(docs.documents.value.map(document => document.id)).toEqual(['b-new', 'b-original'])
    expect(docs.uploading.value).toBe(false)
  })

  it.each(['resolve', 'reject'] as const)('does not expose A delete %s after an account switch', async (outcome) => {
    const request = deferred<undefined>()
    fetchMock.mockReturnValueOnce(request.promise)
    const docs = scope.run(() => usePortalDocuments())!
    const removing = docs.remove('a-original')
    const cancelled = expect(removing).rejects.toMatchObject({ name: 'AbortError' })
    const signal = fetchMock.mock.calls[0]![1].signal as AbortSignal
    expect(docs.documents.value).toEqual([])
    user.value = { sub: 'tenant-b' }
    documentData.value = { data: [documentFor('b-original')] }
    if (outcome === 'resolve') request.resolve(undefined)
    else request.reject(new Error('A private deletion failure'))
    await cancelled

    expect(signal.aborted).toBe(true)
    expect(docs.documents.value).toEqual([documentFor('b-original')])
  })

  it('does not apply an older upload after the same account refreshes documents', async () => {
    const request = deferred<ApiSuccess<TenantDocument>>()
    uploadMock.mockReturnValueOnce(request.promise)
    const docs = scope.run(() => usePortalDocuments())!
    const uploading = docs.upload(new File(['A'], 'a.pdf', { type: 'application/pdf' }))
    const cancelled = expect(uploading).rejects.toMatchObject({ name: 'AbortError' })
    await docs.refresh()
    documentData.value = { data: [documentFor('fresh-document')] }
    request.resolve({ data: documentFor('old-upload') })
    await cancelled

    expect(refreshDocuments).toHaveBeenCalledOnce()
    expect(docs.documents.value).toEqual([documentFor('fresh-document')])
    expect(docs.uploading.value).toBe(false)
    expect(docs.progress.value).toBe(0)
  })

  it('restores only the failed removal while preserving a concurrent successful upload', async () => {
    const request = deferred<undefined>()
    fetchMock.mockReturnValueOnce(request.promise)
    uploadMock.mockResolvedValueOnce({ data: documentFor('a-new', '2026-11-27T11:00:00Z') })
    const docs = scope.run(() => usePortalDocuments())!
    const removing = docs.remove('a-original')
    const failure = expect(removing).rejects.toThrow('Delete failed')
    await docs.upload(new File(['A'], 'a.pdf', { type: 'application/pdf' }))
    request.reject(new Error('Delete failed'))
    await failure

    expect(docs.documents.value.map(document => document.id)).toEqual(['a-new', 'a-original'])
  })

  it('aborts pending mutations on scope disposal and ignores late responses', async () => {
    const save = deferred<ApiSuccess<TenantProfile>>()
    const upload = deferred<ApiSuccess<TenantDocument>>()
    fetchMock.mockReturnValueOnce(save.promise)
    uploadMock.mockReturnValueOnce(upload.promise)
    const form = scope.run(() => usePortalProfile())!
    const docs = scope.run(() => usePortalDocuments())!
    const saving = form.save({ occupation: 'Bản nháp' })
    const uploading = docs.upload(new File(['A'], 'a.pdf', { type: 'application/pdf' }))
    const cancelled = expect(uploading).rejects.toMatchObject({ name: 'AbortError' })
    scope.stop()
    bootstrap.value = bootstrapFor('tenant-a')
    save.resolve({ data: { ...profileFor('tenant-a'), occupation: 'Bản nháp' } })
    upload.resolve({ data: documentFor('late-upload') })

    await expect(saving).resolves.toBe(false)
    await cancelled
    expect((fetchMock.mock.calls[0]![1].signal as AbortSignal).aborted).toBe(true)
    expect((uploadMock.mock.calls[0]![2] as UploadOptions).signal?.aborted).toBe(true)
    expect(form.profile.value?.occupation).toBeNull()
    expect(docs.documents.value).toEqual([documentFor('a-original')])
  })
})
