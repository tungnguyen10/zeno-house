import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import UiCheckbox from '~/components/ui/UiCheckbox.vue'

const mountCheckbox = (props: Record<string, unknown> = {}) =>
  mount(UiCheckbox, { props: { label: 'Tòa A', ...props }, global: { stubs: { IconCheckSmall: true } } })

describe('UiCheckbox', () => {
  it('merges rowClass into the inner label', () => {
    const label = mountCheckbox({ rowClass: 'min-h-11 items-center sm:min-h-0' }).get('label')

    expect(label.classes()).toEqual(expect.arrayContaining(['flex', 'gap-2', 'min-h-11', 'items-center', 'sm:min-h-0']))
  })

  it('keeps the default label classes when rowClass is omitted', () => {
    const label = mountCheckbox().get('label')

    expect(label.classes()).toEqual(['flex', 'items-start', 'gap-2'])
  })
})
