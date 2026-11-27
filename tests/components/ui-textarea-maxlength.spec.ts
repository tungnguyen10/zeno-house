import { mount } from '@vue/test-utils'
import { expect, it } from 'vitest'
import UiTextarea from '~/components/ui/UiTextarea.vue'

it.each([4000, '4000'])('applies numeric and literal-string maxlength %s to the editable textarea', (maxlength) => {
  const wrapper = mount(UiTextarea, { props: { label: 'Public response', maxlength } })
  expect(wrapper.get('textarea').attributes('maxlength')).toBe('4000')
  expect(wrapper.attributes('maxlength')).toBeUndefined()
})
