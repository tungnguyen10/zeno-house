import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import InvoicePaymentProfileCard from '../../../app/components/invoices/InvoicePaymentProfileCard.vue'

const profile = {
  bankName: 'VIB',
  accountHolder: 'NGUYỄN TUẤN ANH',
  accountNumber: '375675817',
  transferContent: 'ZHA-101-INV-001-07/2026',
  qrImageUrl: 'https://signed.example/qr.webp',
  logoImageUrl: null,
  snapshottedAt: '2026-07-20T00:00:00.000Z',
}

describe('InvoicePaymentProfileCard', () => {
  it('renders compact immutable payment instructions and QR', () => {
    const wrapper = mount(InvoicePaymentProfileCard, {
      props: { profile },
      global: { stubs: { IconLogo: defineComponent({ template: '<span data-test="zeno-logo" />' }) } },
    })

    expect(wrapper.text()).toContain('Thông tin chuyển khoản khi phát hành')
    expect(wrapper.text()).toContain('NGUYỄN TUẤN ANH')
    expect(wrapper.text()).toContain('375675817')
    expect(wrapper.text()).toContain('ZHA-101-INV-001-07/2026')
    expect(wrapper.get('img[alt="Mã QR chuyển khoản ngân hàng"]').attributes('src')).toContain('qr.webp')
  })

  it('explains a missing snapshot without reading current building settings', () => {
    const wrapper = mount(InvoicePaymentProfileCard, { props: { profile: null } })

    expect(wrapper.text()).toContain('Hóa đơn này chưa lưu thông tin thanh toán')
    expect(wrapper.find('img').exists()).toBe(false)
  })
})
