import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PortalIdentityImageSlot from '~/components/portal/PortalIdentityImageSlot.vue'

const stubs = {
  IconPhoto: true,
  IconSpinner: true,
  IconRefresh: true,
  IconTrash: true,
  PortalButton: { template: '<button><slot /></button>' },
}

describe('PortalIdentityImageSlot', () => {
  it('gives the empty upload target a visible keyboard focus treatment', () => {
    const wrapper = mount(PortalIdentityImageSlot, {
      props: { label: 'Mặt trước', signedUrl: null },
      global: { stubs },
    })
    expect(wrapper.get('button').classes()).toEqual(expect.arrayContaining([
      'focus-visible:ring-2',
      'focus-visible:ring-theme/40',
    ]))
  })

  it('uses semantic progress while an identity image uploads', () => {
    const wrapper = mount(PortalIdentityImageSlot, {
      props: { label: 'Mặt trước', signedUrl: null, uploading: true, progress: 42 },
      global: { stubs },
    })
    const progress = wrapper.get('progress')
    expect(progress.attributes('value')).toBe('42')
    expect(progress.attributes('max')).toBe('100')
  })
})
