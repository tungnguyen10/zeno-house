import { computed, ref, toValue } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('toValue', toValue)

describe('invoice email composables', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('enqueues without automatic mutation retry and blocks a duplicate in-flight action', async () => {
    let resolveRequest!: (value: unknown) => void
    const apiFetch = vi.fn(() => new Promise(resolve => {
      resolveRequest = resolve
    }))
    vi.stubGlobal('apiFetch', apiFetch)
    const { useInvoiceEmailDelivery } = await import(
      '../../app/composables/invoices/useInvoiceEmailDelivery'
    )
    const delivery = useInvoiceEmailDelivery()

    const pending = delivery.enqueue(['invoice-1'])
    await expect(delivery.enqueue(['invoice-1']))
      .rejects.toThrow('INVOICE_EMAIL_SEND_IN_FLIGHT')
    expect(apiFetch).toHaveBeenCalledTimes(1)
    expect(apiFetch).toHaveBeenCalledWith('/api/billing/invoices/email-deliveries', {
      method: 'POST',
      body: { invoice_ids: ['invoice-1'] },
    })

    resolveRequest({ data: { results: [{ status: 'queued' }] } })
    await expect(pending).resolves.toMatchObject({ results: [{ status: 'queued' }] })
    expect(delivery.sending.value).toBe(false)
  })

  it('loads scoped newest-first history and clears stale state', async () => {
    const apiFetch = vi.fn().mockResolvedValue({
      data: [{ id: 'delivery-new', status: 'delivered' }],
    })
    vi.stubGlobal('apiFetch', apiFetch)
    const { useInvoiceEmailDelivery } = await import(
      '../../app/composables/invoices/useInvoiceEmailDelivery'
    )
    const delivery = useInvoiceEmailDelivery()

    await delivery.loadHistory('INV 2026/01')
    expect(apiFetch).toHaveBeenCalledWith(
      '/api/billing/invoices/INV%202026%2F01/email-deliveries',
    )
    expect(delivery.history.value).toMatchObject([{ id: 'delivery-new' }])

    delivery.clear()
    expect(delivery.history.value).toEqual([])
    expect(delivery.error.value).toBeNull()
  })

  it('updates a bootstrap-backed building setting and preserves default-off state', async () => {
    const sourceData = ref(null)
    const source = {
      data: sourceData,
      status: ref('success'),
      error: ref(null),
      set: vi.fn(value => { sourceData.value = value }),
    }
    const updated = {
      buildingId: 'building-1',
      autoSendEnabled: true,
      featureAvailable: true,
      createdAt: null,
      updatedAt: '2026-07-23T01:00:00.000Z',
      updatedBy: 'owner-1',
    }
    const apiFetch = vi.fn().mockResolvedValue({ data: updated })
    vi.stubGlobal('apiFetch', apiFetch)
    const { useBuildingInvoiceEmailSettings } = await import(
      '../../app/composables/buildings/useBuildingInvoiceEmailSettings'
    )
    const settings = useBuildingInvoiceEmailSettings('building-1', source)

    expect(settings.settings.value).toBeNull()
    await expect(settings.update(true)).resolves.toEqual(updated)
    expect(apiFetch).toHaveBeenCalledWith(
      '/api/buildings/building-1/invoice-email-settings',
      { method: 'PUT', body: { auto_send_enabled: true } },
    )
    expect(source.set).toHaveBeenCalledWith(updated)
    expect(settings.settings.value).toEqual(updated)
  })
})
