import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiFetch = vi.fn()
const printNow = vi.fn()
const routerBack = vi.fn()
const routerPush = vi.fn()
let query: Record<string, string | undefined> = {}

vi.stubGlobal('definePageMeta', vi.fn())
vi.stubGlobal('useRoute', () => ({ query }))
vi.stubGlobal('useRouter', () => ({ back: routerBack, push: routerPush }))
vi.stubGlobal('useInvoicePrinting', () => ({ printNow }))
vi.stubGlobal('apiFetch', (...args: unknown[]) => apiFetch(...args))

const InvoicePrintPage = (await import('../../app/pages/dashboard/invoices/print.vue')).default

function mountPage() {
  return mount(InvoicePrintPage, {
    global: {
      stubs: {
        InvoicePrintCard: {
          props: ['item'],
          template: '<article data-test="invoice-card">{{ item.invoice.id }}</article>',
        },
        UiButton: {
          props: ['disabled'],
          emits: ['click'],
          template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
        },
      },
    },
  })
}

describe('issued invoice print page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    query = { ids: '00000000-0000-4000-8000-000000000001' }
  })

  it('keeps print disabled while the snapshot batch is loading', async () => {
    apiFetch.mockReturnValue(new Promise(() => {}))

    const wrapper = mountPage()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Đang tải dữ liệu...')
    expect(wrapper.get('button:last-child').attributes('disabled')).toBeDefined()
  })

  it('shows an error and keeps print disabled when batch loading fails', async () => {
    apiFetch.mockRejectedValue(new Error('Không có quyền in hóa đơn'))

    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.text()).toContain('Không thể tải dữ liệu in')
    expect(wrapper.get('button:last-child').attributes('disabled')).toBeDefined()
  })

  it('shows an empty state and keeps print disabled for an empty response', async () => {
    apiFetch.mockResolvedValue({ data: [] })

    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.text()).toContain('Không có hóa đơn nào để in.')
    expect(wrapper.get('button:last-child').attributes('disabled')).toBeDefined()
  })

  it('renders the complete batch and prints its invoice ids', async () => {
    apiFetch.mockResolvedValue({
      data: [
        { invoice: { id: 'invoice-2' } },
        { invoice: { id: 'invoice-1' } },
      ],
    })

    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.findAll('[data-test="invoice-card"]')).toHaveLength(2)
    expect(wrapper.get('button:last-child').attributes('disabled')).toBeUndefined()
    await wrapper.get('button:last-child').trigger('click')
    expect(printNow).toHaveBeenCalledWith(['invoice-2', 'invoice-1'])
  })

  it('rejects an empty route selection without calling the API', async () => {
    query = {}

    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.text()).toContain('Chọn từ 1 đến 100 hoá đơn để in')
    expect(apiFetch).not.toHaveBeenCalled()
  })
})
