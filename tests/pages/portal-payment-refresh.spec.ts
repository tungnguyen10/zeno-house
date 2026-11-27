import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import InvoiceDetail from '~/pages/portal/invoices/[id].vue'

const invoice = ref({
  id: 'invoice-1', invoiceCode: 'inv-2026-11-01', periodYear: 2026, periodMonth: 11,
  status: 'issued', totalAmount: 1_000_000, paidAmount: 0, balanceAmount: 1_000_000,
  dueDate: '2026-11-30', overdueDate: '2026-12-03', issuedAt: null,
  roomNumber: '101', buildingName: 'A', charges: [], payments: [], invoiceProfile: null,
})
const error = ref<unknown>(null)
const refresh = vi.fn(async () => {})
const info = vi.fn()
const success = vi.fn()
const toastError = vi.fn()
const stubs = {
  PortalCard: { template: '<section><slot /></section>' },
  PortalButton: { props: ['loading'], template: '<button :disabled="loading"><slot /></button>' },
  PortalInvoicePaymentInstructions: true,
  PortalStatusBadge: true,
  PortalSkeleton: true,
  PortalEmptyState: true,
  IconRefresh: true,
}

beforeEach(() => {
  vi.clearAllMocks()
  invoice.value.status = 'issued'
  invoice.value.paidAmount = 0
  invoice.value.balanceAmount = 1_000_000
  error.value = null
  refresh.mockResolvedValue(undefined)
  vi.stubGlobal('definePageMeta', vi.fn())
  vi.stubGlobal('useRoute', () => ({ params: { id: 'invoice-1' } }))
  vi.stubGlobal('usePortalChrome', () => ({ setChrome: vi.fn() }))
  vi.stubGlobal('usePortalInvoiceDetail', () => ({ invoice, status: ref('success'), error, refresh }))
  vi.stubGlobal('usePortalToast', () => ({ info, success, error: toastError }))
})

describe('payment verification feedback', () => {
  it('shows an inline checked time without a redundant toast when the server balance is unchanged', async () => {
    const wrapper = mount(InvoiceDetail, { global: { stubs } })
    await wrapper.findAll('button').find(button => button.text().includes('Kiểm tra thanh toán'))!.trigger('click')
    await flushPromises()
    expect(refresh).toHaveBeenCalledOnce()
    expect(wrapper.get('[role="status"]').text()).toContain('Đã kiểm tra lúc')
    expect(info).not.toHaveBeenCalled()
    expect(success).not.toHaveBeenCalled()
    expect(invoice.value.balanceAmount).toBe(1_000_000)
    wrapper.unmount()
  })

  it('announces paid only after the refreshed server result says paid', async () => {
    refresh.mockImplementationOnce(async () => {
      invoice.value.status = 'paid'
      invoice.value.paidAmount = 1_000_000
      invoice.value.balanceAmount = 0
    })
    const wrapper = mount(InvoiceDetail, { global: { stubs } })
    await wrapper.findAll('button').find(button => button.text().includes('Kiểm tra thanh toán'))!.trigger('click')
    await flushPromises()
    expect(success).toHaveBeenCalledOnce()
    expect(info).not.toHaveBeenCalled()
    expect(wrapper.text()).not.toContain('Bạn đã chuyển khoản?')
    wrapper.unmount()
  })
})
