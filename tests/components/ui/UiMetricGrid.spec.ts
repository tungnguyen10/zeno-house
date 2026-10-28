import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import UiMetricGrid from '~/components/ui/UiMetricGrid.vue'

const slots = { default: '<div>a</div><div>b</div><div>c</div>' }

describe('UiMetricGrid', () => {
  it('defaults to two columns on mobile and three from md', () => {
    const wrapper = mount(UiMetricGrid, { slots })

    expect(wrapper.classes()).toEqual(expect.arrayContaining(['grid', 'grid-cols-2', 'md:grid-cols-3']))
  })

  it.each([
    [2, 'md:grid-cols-2'],
    [4, 'md:grid-cols-4'],
    [5, 'md:grid-cols-5'],
  ] as const)('maps cols=%i to %s', (cols, expected) => {
    const wrapper = mount(UiMetricGrid, { props: { cols }, slots })

    expect(wrapper.classes()).toContain(expected)
  })

  it('stretches an orphan last cell across both mobile columns', () => {
    const wrapper = mount(UiMetricGrid, { slots })

    expect(wrapper.classes()).toContain('max-md:[&>*:last-child:nth-child(odd)]:col-span-2')
  })

  it('renders an edge-to-edge chip strip below md and a card grid from md when chips is set', () => {
    const wrapper = mount(UiMetricGrid, { props: { chips: true, cols: 5 }, slots })

    expect(wrapper.classes()).toEqual(expect.arrayContaining(['flex', 'overflow-x-auto', 'snap-x', '-mx-4', 'md:grid', 'md:rounded-xl', 'md:grid-cols-5']))
    expect(wrapper.classes()).not.toContain('grid-cols-2')
    expect(wrapper.classes()).not.toContain('rounded-xl')
  })
})
