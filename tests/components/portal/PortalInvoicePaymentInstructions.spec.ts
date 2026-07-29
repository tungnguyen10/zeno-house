import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PortalInvoicePaymentInstructions from '~/components/portal/PortalInvoicePaymentInstructions.vue'

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}))

vi.mock('~/composables/tenant-portal/usePortalToast', () => ({
  usePortalToast: () => toast,
}))

const profile = {
  bankName: 'Vietcombank',
  accountHolder: 'ZENO HOUSE',
  accountNumber: '0123456789',
  transferContent: 'INV-2607-001 P101',
  qrImageUrl: 'https://signed.example/qr.png',
  logoImageUrl: null,
  snapshottedAt: '2026-07-01T00:00:00.000Z',
}

const stubs = {
  IconCheckSmall: true,
  IconCopy: true,
  PortalButton: {
    props: ['ariaLabel'],
    emits: ['click'],
    template: '<button :aria-label="ariaLabel" @click="$emit(\'click\')"><slot /></button>',
  },
}

describe('PortalInvoicePaymentInstructions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  it('makes an outstanding invoice actionable with amount, QR, and copy controls', () => {
    const wrapper = mount(PortalInvoicePaymentInstructions, {
      props: { profile, amount: 1_500_000, mode: 'outstanding' },
      global: { stubs },
    })

    expect(wrapper.text()).toContain('Thanh toán chuyển khoản')
    expect(wrapper.text()).toContain('Số tiền cần chuyển')
    expect(wrapper.text()).toContain('1.500.000')
    expect(wrapper.get('img[alt="Mã QR chuyển khoản"]').attributes('src')).toBe(profile.qrImageUrl)
    expect(wrapper.get('[aria-label="Sao chép số tài khoản"]')).toBeTruthy()
    expect(wrapper.get('[aria-label="Sao chép nội dung chuyển khoản"]')).toBeTruthy()
  })

  it('keeps paid history read-only without amount, QR, or copy controls', () => {
    const wrapper = mount(PortalInvoicePaymentInstructions, {
      props: { profile, amount: 0, mode: 'history' },
      global: { stubs },
    })

    expect(wrapper.text()).toContain('Thông tin chuyển khoản khi phát hành')
    expect(wrapper.text()).not.toContain('Số tiền cần chuyển')
    expect(wrapper.find('img[alt="Mã QR chuyển khoản"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label^="Sao chép"]').exists()).toBe(false)
  })

  it('explains a missing historical snapshot without inventing current details', () => {
    const wrapper = mount(PortalInvoicePaymentInstructions, {
      props: { profile: null, amount: 1_500_000, mode: 'outstanding' },
      global: { stubs },
    })

    expect(wrapper.text()).toContain('Chưa có thông tin chuyển khoản')
    expect(wrapper.text()).toContain('Liên hệ quản lý')
    expect(wrapper.text()).toContain('không dùng cấu hình hiện tại')
  })

  it('keeps text details available when the QR asset is unavailable', () => {
    const wrapper = mount(PortalInvoicePaymentInstructions, {
      props: {
        profile: { ...profile, qrImageUrl: null },
        amount: 1_500_000,
        mode: 'outstanding',
      },
      global: { stubs },
    })

    expect(wrapper.text()).toContain('QR chưa khả dụng')
    expect(wrapper.text()).toContain(profile.accountNumber)
    expect(wrapper.text()).toContain(profile.transferContent)
  })

  it('copies the exact account number and confirms through the portal toast', async () => {
    const wrapper = mount(PortalInvoicePaymentInstructions, {
      props: { profile, amount: 1_500_000, mode: 'outstanding' },
      global: { stubs },
    })

    await wrapper.get('[aria-label="Sao chép số tài khoản"]').trigger('click')
    await vi.waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(profile.accountNumber)
      expect(toast.success).toHaveBeenCalledWith('Đã sao chép số tài khoản')
    })
  })

  it('reports clipboard failure instead of claiming success', async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error('denied'))
    const wrapper = mount(PortalInvoicePaymentInstructions, {
      props: { profile, amount: 1_500_000, mode: 'outstanding' },
      global: { stubs },
    })

    await wrapper.get('[aria-label="Sao chép nội dung chuyển khoản"]').trigger('click')
    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Không thể sao chép. Hãy nhấn giữ để sao chép thủ công.')
      expect(toast.success).not.toHaveBeenCalled()
    })
  })
})
