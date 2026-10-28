import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import UiMetric from '~/components/ui/UiMetric.vue'

const stubs = { UiSkeleton: { template: '<span data-test="skeleton" />' } }

describe('UiMetric', () => {
  it('renders label and value with the tone color on the value', () => {
    const wrapper = mount(UiMetric, {
      props: { label: 'Đã thu', value: '10 ₫', tone: 'success' },
      global: { stubs },
    })

    expect(wrapper.text()).toContain('Đã thu')
    expect(wrapper.find('p.text-status-success').text()).toBe('10 ₫')
  })

  it('keeps the caption visible', () => {
    const wrapper = mount(UiMetric, {
      props: { label: 'Đã chốt', value: '3/4', caption: '1 phòng chỉ chốt 1 đồng hồ' },
      global: { stubs },
    })

    expect(wrapper.text()).toContain('1 phòng chỉ chốt 1 đồng hồ')
  })

  it('exposes hint as a tooltip without adding visible text', () => {
    const wrapper = mount(UiMetric, {
      props: { label: 'Lợi nhuận', value: '5 ₫', hint: 'Doanh thu − chi phí' },
      global: { stubs },
    })

    expect(wrapper.attributes('title')).toBe('Doanh thu − chi phí')
    expect(wrapper.text()).not.toContain('Doanh thu − chi phí')
  })

  it('renders a skeleton instead of the value while loading', () => {
    const wrapper = mount(UiMetric, {
      props: { label: 'Đã thu', value: '10 ₫', loading: true },
      global: { stubs },
    })

    expect(wrapper.find('[data-test="skeleton"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('10 ₫')
  })
})
