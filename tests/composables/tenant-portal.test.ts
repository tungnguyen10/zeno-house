import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { TenantProfile, TenantSupportRequest } from '~/types/tenant-portal'

const fetchMock = vi.hoisted(() => vi.fn())
const uploadMock = vi.hoisted(() => vi.fn())

// apiFetch (setup.ts) proxies to $fetch; upload uses the XHR helper we mock here.
vi.stubGlobal('$fetch', fetchMock)
vi.mock('~/utils/upload', () => ({ uploadWithProgress: uploadMock }))

let fetchData: unknown
const useFetchMock = vi.fn(() => ({
  data: ref(fetchData ?? null),
  status: ref('success'),
  error: ref(null),
  refresh: vi.fn(async () => {}),
}))

vi.stubGlobal('useFetch', useFetchMock)

const baseProfile: TenantProfile = {
  id: 't1',
  code: 'T-001',
  fullName: 'Nguyen Van A',
  phone: '0901',
  email: 'a@example.com',
  emergencyContactName: null,
  emergencyContactPhone: null,
  notes: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  fetchData = undefined
})

describe('usePortalIdentityImages', () => {
  it('uploads to the side-scoped endpoint without inventing a storage path', async () => {
    uploadMock.mockResolvedValue({ data: { frontSignedUrl: 'https://signed/front', backSignedUrl: null } })
    const { usePortalIdentityImages } = await import('../../app/composables/tenant-portal/usePortalIdentityImages')
    const { upload, images } = usePortalIdentityImages()

    await upload('front', new File(['x'], 'front.jpg', { type: 'image/jpeg' }))

    const [url, form] = uploadMock.mock.calls[0]!
    expect(url).toBe('/api/tenant/id-images/front')
    expect(form).toBeInstanceOf(FormData)
    expect(images.value.frontSignedUrl).toBe('https://signed/front')
  })

  it('removes a side through the DELETE endpoint', async () => {
    fetchData = { data: { frontSignedUrl: 'x', backSignedUrl: null } }
    fetchMock.mockResolvedValue({ data: { frontSignedUrl: null, backSignedUrl: null } })
    const { usePortalIdentityImages } = await import('../../app/composables/tenant-portal/usePortalIdentityImages')
    const { remove } = usePortalIdentityImages()

    await remove('front')

    expect(fetchMock).toHaveBeenCalledWith('/api/tenant/id-images/front', { method: 'DELETE' })
  })
})

describe('usePortalDocuments', () => {
  it('uploads free-form documents to /api/tenant/documents and lists the signed URL', async () => {
    fetchData = { data: [] }
    uploadMock.mockResolvedValue({
      data: { id: 'd1', name: 'a.pdf', mimeType: 'application/pdf', size: 10, createdAt: '', signedUrl: 'https://signed/doc' },
    })
    const { usePortalDocuments } = await import('../../app/composables/tenant-portal/usePortalDocuments')
    const { upload, documents } = usePortalDocuments()

    await upload(new File(['x'], 'a.pdf', { type: 'application/pdf' }))

    expect(uploadMock.mock.calls[0]![0]).toBe('/api/tenant/documents')
    expect(documents.value[0]!.signedUrl).toBe('https://signed/doc')
  })

  it('deletes a document optimistically via the id endpoint', async () => {
    fetchData = { data: [{ id: 'd1', name: 'a.pdf', mimeType: 'application/pdf', size: 10, createdAt: '', signedUrl: 'x' }] }
    fetchMock.mockResolvedValue(undefined)
    const { usePortalDocuments } = await import('../../app/composables/tenant-portal/usePortalDocuments')
    const { remove, documents } = usePortalDocuments()

    await remove('d1')

    expect(fetchMock).toHaveBeenCalledWith('/api/tenant/documents/d1', { method: 'DELETE' })
    expect(documents.value).toHaveLength(0)
  })
})

describe('usePortalProfile', () => {
  it('saves whitelisted fields via PATCH /api/tenant/me and applies the update', async () => {
    fetchData = { data: { profile: baseProfile, contract: null, invoices: [], invoiceMeta: {} } }
    fetchMock.mockResolvedValue({ data: { ...baseProfile, phone: '0999' } })
    const { usePortalProfile } = await import('../../app/composables/tenant-portal/usePortalProfile')
    const { save, profile } = usePortalProfile()

    const ok = await save({ phone: '0999' })

    expect(ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith('/api/tenant/me', { method: 'PATCH', body: { phone: '0999' } })
    expect(profile.value?.phone).toBe('0999')
  })

  it('rolls back the optimistic update when the save fails', async () => {
    fetchData = { data: { profile: baseProfile, contract: null, invoices: [], invoiceMeta: {} } }
    fetchMock.mockRejectedValue({ data: { error: { message: 'Lỗi' } } })
    const { usePortalProfile } = await import('../../app/composables/tenant-portal/usePortalProfile')
    const { save, profile, apiError } = usePortalProfile()

    const ok = await save({ phone: '0999' })

    expect(ok).toBe(false)
    expect(profile.value?.phone).toBe(baseProfile.phone)
    expect(apiError.value).toBeTruthy()
  })
})

describe('portal bootstrap data', () => {
  it('uses one keyed SSR endpoint for profile, contract, and invoices composables', async () => {
    fetchData = {
      data: { profile: baseProfile, contract: null, invoices: [], invoiceMeta: { total: 0 } },
    }
    const { usePortalProfile } = await import('../../app/composables/tenant-portal/usePortalProfile')
    const { usePortalContract } = await import('../../app/composables/tenant-portal/usePortalContract')
    const { usePortalInvoices } = await import('../../app/composables/tenant-portal/usePortalInvoices')

    usePortalProfile()
    usePortalContract()
    usePortalInvoices()

    expect(useFetchMock).toHaveBeenCalledTimes(3)
    for (const call of useFetchMock.mock.calls.slice(-3)) {
      expect(call[0]).toBe('/api/tenant/bootstrap')
      expect(call[1]).toMatchObject({ key: 'portal-bootstrap' })
    }
  })
})

describe('usePortalRequests', () => {
  const request: TenantSupportRequest = {
    id: 'r1',
    tenantId: 't1',
    buildingId: 'b1',
    contractId: 'c1',
    title: 'Vòi nước bị rò rỉ',
    description: 'Nước rò dưới bồn rửa.',
    status: 'new',
    attachmentSignedUrl: null,
    createdAt: '2026-07-17T10:00:00.000Z',
    updatedAt: '2026-07-17T10:00:00.000Z',
  }

  it('submits JSON without obsolete category or context fields', async () => {
    fetchData = { data: [] }
    fetchMock.mockResolvedValue({ data: request })
    const { usePortalRequests } = await import(
      '../../app/composables/tenant-portal/usePortalRequests'
    )
    const { submit } = usePortalRequests()

    await expect(submit({
      title: 'Vòi nước bị rò rỉ',
      description: 'Nước rò dưới bồn rửa.',
    })).resolves.toBe(true)

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/tenant/requests',
      expect.objectContaining({
        method: 'POST',
        body: {
          title: 'Vòi nước bị rò rỉ',
          description: 'Nước rò dưới bồn rửa.',
        },
      }),
    )
  })

  it('submits an optional attachment as multipart form data', async () => {
    fetchData = { data: [] }
    uploadMock.mockResolvedValue({ data: request })
    const { usePortalRequests } = await import(
      '../../app/composables/tenant-portal/usePortalRequests'
    )
    const { submit } = usePortalRequests()
    const attachment = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })

    await expect(submit({
      title: 'Vòi nước bị rò rỉ',
      description: 'Nước rò dưới bồn rửa.',
      attachment,
    })).resolves.toBe(true)

    const [url, form] = uploadMock.mock.calls[0]!
    expect(url).toBe('/api/tenant/requests')
    expect(form).toBeInstanceOf(FormData)
    expect((form as FormData).get('title')).toBe('Vòi nước bị rò rỉ')
    expect((form as FormData).get('description')).toBe('Nước rò dưới bồn rửa.')
    expect((form as FormData).get('attachment')).toBeInstanceOf(File)
  })
})
