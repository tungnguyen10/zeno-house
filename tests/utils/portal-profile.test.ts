import { describe, expect, it } from 'vitest'
import type { TenantProfile } from '~/types/tenant-portal'
import { buildTenantProfileChanges, toTenantProfileEditForm, validateTenantProfileChanges } from '~/utils/portal-profile'

const profile = {
  id: 'tenant-1', code: 'QA-001', status: 'active', fullName: 'Khách Giả Lập',
  phone: '0900000000', email: 'fixture@example.test', gender: 'other', dateOfBirth: '1990-01-01',
  occupation: null, permanentAddress: 'Địa chỉ giả lập', idNumber: 'FAKE0001',
  idIssuedDate: '2020-01-01', idIssuedPlace: 'Nơi cấp giả lập',
  emergencyContactName: null, emergencyContactPhone: null,
} satisfies TenantProfile

describe('portal four-field contact edit model', () => {
  it('only maps four contact fields even when a stale DTO contains internal notes', () => {
    expect(toTenantProfileEditForm({ ...profile, notes: 'Private fixture' } as TenantProfile)).toEqual({
      phone: '0900000000', occupation: '', emergency_contact_name: '', emergency_contact_phone: '',
    })
  })
  it('keeps optional whitespace clean and does not change equal normalized values', () => {
    const baseline = toTenantProfileEditForm(profile)
    expect(buildTenantProfileChanges({ ...baseline, occupation: '   ' }, baseline)).toBeNull()
  })
  it('only submits changed contact fields and clears optional fields to null', () => {
    const baseline = toTenantProfileEditForm({ ...profile, occupation: 'Old work', emergencyContactName: 'Old contact', emergencyContactPhone: '0900000001' })
    expect(buildTenantProfileChanges({ ...baseline, phone: ' 0900000002 ', occupation: '   ', emergency_contact_name: '', emergency_contact_phone: '' }, baseline))
      .toEqual({ phone: '0900000002', occupation: null, emergency_contact_name: null, emergency_contact_phone: null })
  })
  it('ignores stale legal/internal model keys when constructing mutations', () => {
    const baseline = toTenantProfileEditForm(profile)
    const stale = { ...baseline, phone: '0900000002', full_name: 'Other', id_number: 'OTHER', notes: 'Private' }
    expect(buildTenantProfileChanges(stale, baseline)).toEqual({ phone: '0900000002' })
  })
  it('validates the canonical phone and rejects empty phone', () => {
    expect(validateTenantProfileChanges({ phone: '+84 90 000 0000' }).data).toEqual({ phone: '0900000000' })
    expect(validateTenantProfileChanges({ phone: '' }).fieldErrors.phone).toEqual(['Số điện thoại không được trống'])
    expect(validateTenantProfileChanges(null)).toEqual({ data: null, fieldErrors: {} })
  })
})
