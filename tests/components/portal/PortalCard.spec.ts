import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PortalCard from '~/components/portal/PortalCard.vue'

describe('PortalCard', () => {
  it('uses the shared portal radius, padding, border, and resting elevation', () => {
    const wrapper = mount(PortalCard)
    expect(wrapper.classes()).toEqual(expect.arrayContaining([
      'rounded-2xl',
      'border',
      'border-border-light',
      'p-4',
      'shadow-[var(--portal-elevation-resting)]',
    ]))
  })

  it.each([
    ['paid', 'border-l-portal-positive'],
    ['due', 'border-l-portal-warning'],
    ['overdue', 'border-l-portal-danger'],
  ] as const)('renders a 3px %s statement accent', (accent, colorClass) => {
    const wrapper = mount(PortalCard, { props: { accent } })
    expect(wrapper.classes()).toContain('border-l-[3px]')
    expect(wrapper.classes()).toContain(colorClass)
  })

  it('renders interactive cards as keyboard-focusable buttons with press feedback', () => {
    const wrapper = mount(PortalCard, { props: { interactive: true } })

    expect(wrapper.element.tagName).toBe('BUTTON')
    expect(wrapper.attributes('type')).toBe('button')
    expect(wrapper.classes()).toEqual(expect.arrayContaining([
      'w-full',
      'text-left',
      'active:scale-[0.99]',
      'focus-visible:ring-2',
      'motion-reduce:transition-none',
    ]))
  })
})
