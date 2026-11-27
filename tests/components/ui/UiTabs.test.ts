import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import UiTabs from '~/components/ui/UiTabs.vue'

const tabs = [
  { key: 'a', label: 'Đang chờ' },
  { key: 'b', label: 'Đã duyệt' },
]

describe('UiTabs', () => {
  it('keeps segmented tabs on one line with a touch-size target below sm', () => {
    const wrapper = mount(UiTabs, { props: { modelValue: 'a', tabs, variant: 'segmented' } })
    const classes = wrapper.get('[role=tab]').classes()
    expect(classes).toEqual(expect.arrayContaining(['whitespace-nowrap', 'shrink-0', 'min-h-11', 'sm:min-h-0']))
  })

  it('leaves the underline variant without the touch-size minimum', () => {
    const wrapper = mount(UiTabs, { props: { modelValue: 'a', tabs } })
    expect(wrapper.get('[role=tab]').classes()).not.toContain('min-h-11')
  })
})
