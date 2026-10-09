import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import UiFormSection from '../../../app/components/ui/UiFormSection.vue'
import UiFormActions from '../../../app/components/ui/UiFormActions.vue'
import { useAppFormMode } from '../../../app/composables/useAppFormMode'

describe('UiFormSection', () => {
  it('puts the label outside the card and the description below it', () => {
    const wrapper = mount(UiFormSection, {
      props: { title: 'Quan hệ', description: 'Phòng và khách thuê.' },
      slots: { default: '<input id="x">' },
    })

    const heading = wrapper.get('h3')
    expect(heading.text()).toBe('Quan hệ')
    expect(heading.classes()).toContain('uppercase')
    expect(wrapper.find('input#x').exists()).toBe(true)
    expect(wrapper.text()).toContain('Phòng và khách thuê.')
  })

  it('renders the footnote slot alongside the description', () => {
    const wrapper = mount(UiFormSection, {
      props: { title: 'Quan hệ', description: 'Mô tả nhóm.' },
      slots: { footnote: '<p>Hợp đồng đang chạy</p>' },
    })

    expect(wrapper.text()).toContain('Mô tả nhóm.')
    expect(wrapper.text()).toContain('Hợp đồng đang chạy')
  })

  it('goes edge-to-edge on mobile and insets from sm up', () => {
    const wrapper = mount(UiFormSection, { props: { title: 'Nhóm' } })

    expect(wrapper.classes()).toEqual(expect.arrayContaining(['-mx-4', 'sm:mx-0']))
  })
})

describe('UiFormActions', () => {
  it('disables submit until the form can be submitted', async () => {
    const wrapper = mount(UiFormActions, { props: { canSubmit: false } })

    const submits = wrapper.findAll('button[type="submit"]')
    expect(submits).toHaveLength(2)
    for (const button of submits) expect(button.attributes('disabled')).toBeDefined()

    await wrapper.setProps({ canSubmit: true })
    for (const button of wrapper.findAll('button[type="submit"]')) {
      expect(button.attributes('disabled')).toBeUndefined()
    }
  })

  it('docks the mobile bar to the bottom edge above the safe area', () => {
    const wrapper = mount(UiFormActions)

    const bar = wrapper.get('[data-test="sticky-save-bar"]')
    expect(bar.classes()).toEqual(expect.arrayContaining([
      'fixed',
      'bottom-0',
      'sm:hidden',
      'pb-[calc(0.75rem+env(safe-area-inset-bottom))]',
    ]))
  })

  it('falls back to the desktop labels when no mobile override is given', () => {
    const wrapper = mount(UiFormActions, { props: { submitLabel: 'Tạo phòng', mobileSubmitLabel: 'Tiếp' } })

    const labels = wrapper.findAll('button[type="submit"]').map(button => button.text())
    expect(labels).toEqual(['Tạo phòng', 'Tiếp'])
  })

  it('claims the mobile tab bar slot while mounted', () => {
    const formMode = useAppFormMode()
    formMode.value = false

    const wrapper = mount(UiFormActions)
    expect(formMode.value).toBe(true)

    wrapper.unmount()
    expect(formMode.value).toBe(false)
  })

  it('emits cancel from both action bars', async () => {
    const wrapper = mount(UiFormActions)

    const cancels = wrapper.findAll('button[type="button"]')
    expect(cancels).toHaveLength(2)
    await cancels[0]!.trigger('click')
    await cancels[1]!.trigger('click')

    expect(wrapper.emitted('cancel')).toHaveLength(2)
  })
})
