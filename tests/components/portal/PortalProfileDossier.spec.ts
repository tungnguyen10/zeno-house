import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { TenantProfile } from '~/types/tenant-portal'
import PortalProfileDossier from '~/components/portal/PortalProfileDossier.vue'

const profile: TenantProfile = {
  id: 'tenant-1',
  code: 'KH-024',
  status: 'active',
  fullName: 'Nguyễn Thanh Tùng',
  phone: '0901234567',
  email: 'tung@example.com',
  gender: 'male',
  dateOfBirth: '1995-08-12',
  occupation: 'Kỹ sư',
  permanentAddress: 'Quận 7, TP.HCM',
  idNumber: '079095001234',
  idIssuedDate: '2021-05-10',
  idIssuedPlace: 'Cục CSQLHC',
  emergencyContactName: 'Nguyễn Văn B',
  emergencyContactPhone: '0912345678',
  notes: 'Liên hệ ngoài giờ hành chính.',
}

const stubs = {
  PortalCard: {
    props: ['padded'],
    template: '<section><slot /></section>',
  },
  PortalChip: {
    props: ['tone'],
    template: '<span><slot /></span>',
  },
}

describe('PortalProfileDossier', () => {
  it('renders every tenant profile field without housing data', () => {
    const wrapper = mount(PortalProfileDossier, {
      props: { profile },
      global: { stubs },
    })

    for (const value of [
      profile.fullName,
      profile.code,
      profile.phone,
      profile.email,
      'Nam',
      '12/08/1995',
      profile.occupation,
      profile.permanentAddress,
      profile.idNumber,
      '10/05/2021',
      profile.idIssuedPlace,
      profile.emergencyContactName,
      profile.emergencyContactPhone,
      profile.notes,
    ]) {
      expect(wrapper.text()).toContain(value)
    }
    expect(wrapper.text()).not.toContain('Phòng')
    expect(wrapper.text()).not.toContain('Hợp đồng')
  })

  it('uses an explicit missing-value label', () => {
    const wrapper = mount(PortalProfileDossier, {
      props: {
        profile: {
          ...profile,
          occupation: null,
          notes: null,
        },
      },
      global: { stubs },
    })

    expect(wrapper.text()).toContain('Chưa cập nhật')
  })

  it('labels verified identity as read-only management data', () => {
    const wrapper = mount(PortalProfileDossier, {
      props: { profile },
      global: { stubs },
    })

    expect(wrapper.text()).toContain('Định danh đã xác minh')
    expect(wrapper.text()).toContain('Liên hệ ban quản lý')
    expect(wrapper.find('input').exists()).toBe(false)
  })
})
