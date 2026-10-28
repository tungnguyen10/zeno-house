import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import UiMetricTile from '~/components/ui/UiMetricTile.vue'

const stubs = { UiSkeleton: { template: '<span data-test="skeleton" />' } }

describe('UiMetricTile', () => {
  it('renders a button with label, value and a tone dot', () => {
    const wrapper = mount(UiMetricTile, {
      props: { label: 'Còn công nợ', value: 2, tone: 'danger' },
      global: { stubs },
    })

    expect(wrapper.element.tagName).toBe('BUTTON')
    expect(wrapper.attributes('type')).toBe('button')
    expect(wrapper.text()).toContain('Còn công nợ')
    expect(wrapper.find('span.text-status-danger').text()).toBe('2')
    expect(wrapper.find('span.bg-status-danger').exists()).toBe(true)
  })

  it('renders the short label for mobile and the full label from md', () => {
    const wrapper = mount(UiMetricTile, {
      props: { label: 'Soát chờ phát hành', shortLabel: 'Chờ phát hành', value: 0 },
      global: { stubs },
    })

    expect(wrapper.get('[data-label="short"]').text()).toBe('Chờ phát hành')
    expect(wrapper.get('[data-label="short"]').classes()).toContain('md:hidden')
    expect(wrapper.get('[data-label="full"]').text()).toBe('Soát chờ phát hành')
    expect(wrapper.get('[data-label="full"]').classes()).toContain('max-md:hidden')
  })

  it('reflects pressed state: solid chip on mobile, ring on desktop', () => {
    const idle = mount(UiMetricTile, { props: { label: 'Đang thu', value: 1 }, global: { stubs } })
    const active = mount(UiMetricTile, { props: { label: 'Đang thu', value: 1, pressed: true }, global: { stubs } })

    expect(idle.attributes('aria-pressed')).toBe('false')
    expect(idle.classes()).not.toContain('md:ring-2')
    expect(idle.classes()).toContain('max-md:rounded-full')
    expect(active.attributes('aria-pressed')).toBe('true')
    expect(active.classes()).toEqual(expect.arrayContaining(['md:ring-2', 'max-md:bg-ui-primary']))
  })

  it('mutes a zero count instead of using the tone color', () => {
    const wrapper = mount(UiMetricTile, { props: { label: 'Còn công nợ', value: 0, tone: 'danger' }, global: { stubs } })

    expect(wrapper.find('span.text-ui-muted.tabular-nums').text()).toBe('0')
    expect(wrapper.find('span.text-status-danger').exists()).toBe(false)
  })

  it('shows a zero value and still toggles', async () => {
    const wrapper = mount(UiMetricTile, { props: { label: 'Đã chốt', value: 0 }, global: { stubs } })

    expect(wrapper.text()).toContain('0')

    await wrapper.trigger('click')

    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('renders a skeleton instead of the value while loading', () => {
    const wrapper = mount(UiMetricTile, {
      props: { label: 'Đã chốt', value: 26, loading: true },
      global: { stubs },
    })

    expect(wrapper.find('[data-test="skeleton"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('26')
  })
})
