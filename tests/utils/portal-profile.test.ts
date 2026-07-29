import { describe, expect, it } from 'vitest'
import type { TenantProfile } from '~/types/tenant-portal'
import {
  buildTenantProfileChanges,
  toTenantProfileEditForm,
  validateTenantProfileChanges,
} from '~/utils/portal-profile'

const profile: TenantProfile = {
  id: 'tenant-1',
  code: 'KH-024',
  status: 'active',
  fullName: 'Nguyễn Thanh Tùng',
  phone: '0901234567',
  email: 'tung@example.com',
  gender: 'male',
  dateOfBirth: '1995-08-12',
  occupation: null,
  permanentAddress: 'Quận 7, TP.HCM',
  idNumber: '079095001234',
  idIssuedDate: '2021-05-10',
  idIssuedPlace: 'Cục CSQLHC',
  emergencyContactName: null,
  emergencyContactPhone: null,
  notes: null,
}

describe('portal profile edit model', () => {
  it('maps nullable DTO values to editable strings', () => {
    expect(toTenantProfileEditForm(profile)).toEqual({
      full_name: 'Nguyễn Thanh Tùng',
      phone: '0901234567',
      gender: 'male',
      date_of_birth: '1995-08-12',
      occupation: '',
      permanent_address: 'Quận 7, TP.HCM',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      notes: '',
    })
  })

  it('returns null when normalized values are unchanged', () => {
    const baseline = toTenantProfileEditForm(profile)
    expect(buildTenantProfileChanges({ ...baseline, occupation: '   ' }, baseline)).toBeNull()
  })

  it('returns only changed fields and normalizes optional blanks to null', () => {
    const baseline = toTenantProfileEditForm(profile)
    expect(buildTenantProfileChanges({
      ...baseline,
      phone: ' 0999999999 ',
      permanent_address: '   ',
    }, baseline)).toEqual({
      phone: '0999999999',
      permanent_address: null,
    })
  })

  it('returns field errors for invalid changed values', () => {
    const baseline = toTenantProfileEditForm(profile)
    const changes = buildTenantProfileChanges({ ...baseline, full_name: ' ' }, baseline)
    const result = validateTenantProfileChanges(changes)
    expect(result.data).toBeNull()
    expect(result.fieldErrors.full_name?.[0]).toBe('Họ tên không được trống')
  })
})
