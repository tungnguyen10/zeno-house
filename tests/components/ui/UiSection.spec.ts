import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import UiSection from '~/components/ui/UiSection.vue'

describe('UiSection', () => {
  it('keeps title and actions on one row from mobile up', () => {
    const wrapper = mount(UiSection, {
      props: { title: 'Chi phí' },
      slots: { actions: '<button>Thêm</button>', default: '<p>body</p>' },
    })

    const header = wrapper.get('header')
    expect(header.classes()).toEqual(expect.arrayContaining(['flex', 'items-center', 'justify-between']))
    expect(header.classes()).not.toContain('flex-col')
    expect(wrapper.get('h2').classes()).toContain('truncate')
  })
})
