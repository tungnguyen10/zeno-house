import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { TenantInvoiceListItem, TenantProfile, TenantSupportRequest } from '~/types/tenant-portal'

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

  it('sends a changed-only whitelist payload through PATCH /api/tenant/me', async () => {
    fetchData = { data: { profile: baseProfile, contract: null, invoices: [], invoiceMeta: {} } }
    fetchMock.mockResolvedValue({ data: { ...baseProfile, occupation: null } })
    const { usePortalProfile } = await import('../../app/composables/tenant-portal/usePortalProfile')
    const { save } = usePortalProfile()

    await save({ occupation: null })

    expect(fetchMock).toHaveBeenCalledWith('/api/tenant/me', {
      method: 'PATCH',
      body: { occupation: null },
    })
  })

  it('optimistically maps identity fields onto the profile DTO', async () => {
    fetchData = { data: { profile: baseProfile, contract: null, invoices: [], invoiceMeta: {} } }
    fetchMock.mockResolvedValue({
      data: {
        ...baseProfile,
        idNumber: '012345678901',
        idIssuedDate: '2020-01-02',
        idIssuedPlace: 'Cục Cảnh sát QLHC về TTXH',
      },
    })
    const { usePortalProfile } = await import('../../app/composables/tenant-portal/usePortalProfile')
    const { save, profile } = usePortalProfile()

    const pending = save({
      id_number: '012345678901',
      id_issued_date: '2020-01-02',
      id_issued_place: 'Cục Cảnh sát QLHC về TTXH',
    })

    expect(profile.value).toMatchObject({
      idNumber: '012345678901',
      idIssuedDate: '2020-01-02',
      idIssuedPlace: 'Cục Cảnh sát QLHC về TTXH',
    })
    await expect(pending).resolves.toBe(true)
  })

  it('exposes a duplicate identity number as field feedback', async () => {
    fetchData = { data: { profile: baseProfile, contract: null, invoices: [], invoiceMeta: {} } }
    fetchMock.mockRejectedValue({
      data: {
        error: {
          message: 'Số CCCD/CMND đã tồn tại',
          details: {
            fieldErrors: {
              id_number: ['Số CCCD/CMND đã tồn tại'],
            },
          },
        },
      },
    })
    const { usePortalProfile } = await import('../../app/composables/tenant-portal/usePortalProfile')
    const { save, fieldErrors } = usePortalProfile()

    await expect(save({ id_number: '012345678901' })).resolves.toBe(false)
    expect(fieldErrors.value.id_number).toEqual(['Số CCCD/CMND đã tồn tại'])
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

  it('picks the latest invoice by billing period even when server order is not newest-first', async () => {
    fetchData = {
      data: {
        profile: baseProfile,
        contract: null,
        invoices: [
          {
            id: 'inv-jun',
            invoiceCode: 'inv-2026-06-0041',
            billingPeriodId: 'period-2026-06',
            periodYear: 2026,
            periodMonth: 6,
            buildingId: 'building-1',
            buildingName: 'A',
            buildingSlug: 'a',
            roomId: 'room-1',
            roomNumber: 'P5',
            contractId: 'contract-1',
            contractCode: 'C-1',
            totalAmount: 7068000,
            paidAmount: 7068000,
            balanceAmount: 0,
            dueDate: '2026-06-10',
            status: 'paid',
            issuedAt: '2026-06-01',
            voidedAt: null,
            voidReason: null,
            notes: null,
          },
          {
            id: 'inv-jul',
            invoiceCode: 'inv-2026-07-0025',
            billingPeriodId: 'period-2026-07',
            periodYear: 2026,
            periodMonth: 7,
            buildingId: 'building-1',
            buildingName: 'A',
            buildingSlug: 'a',
            roomId: 'room-1',
            roomNumber: 'P5',
            contractId: 'contract-1',
            contractCode: 'C-1',
            totalAmount: 6892000,
            paidAmount: 6892000,
            balanceAmount: 0,
            dueDate: '2026-07-10',
            status: 'paid',
            issuedAt: '2026-07-01',
            voidedAt: null,
            voidReason: null,
            notes: null,
          },
        ],
        invoiceMeta: { total: 2, page: 1, limit: 20, totalPages: 1 },
      },
    }

    const { usePortalInvoices } = await import('../../app/composables/tenant-portal/usePortalInvoices')
    const { latest } = usePortalInvoices()

    expect(latest.value?.periodMonth).toBe(7)
    expect(latest.value?.invoiceCode).toBe('inv-2026-07-0025')
  })

  it('loads subsequent invoice pages once and resets them on refresh', async () => {
    const first = { id: 'invoice-1' } as TenantInvoiceListItem
    const second = { id: 'invoice-2' } as TenantInvoiceListItem
    fetchData = {
      data: {
        profile: baseProfile,
        contract: null,
        invoices: [first],
        invoiceMeta: { total: 2, page: 1, limit: 1, totalPages: 2 },
      },
    }
    fetchMock.mockResolvedValue({
      data: [second],
      meta: { total: 2, page: 2, limit: 1, totalPages: 2 },
    })
    const { usePortalInvoices } = await import('../../app/composables/tenant-portal/usePortalInvoices')
    const { invoices, hasMore, loadMore, refresh } = usePortalInvoices()

    await loadMore()
    expect(fetchMock).toHaveBeenCalledWith('/api/tenant/invoices', {
      query: { page: 2, page_size: 1 },
    })
    expect(invoices.value.map(invoice => invoice.id)).toEqual(['invoice-1', 'invoice-2'])
    expect(hasMore.value).toBe(false)

    await refresh()
    expect(invoices.value.map(invoice => invoice.id)).toEqual(['invoice-1'])
    expect(hasMore.value).toBe(true)
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
