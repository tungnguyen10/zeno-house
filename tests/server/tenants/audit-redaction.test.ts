import { describe, expect, it } from 'vitest'
import { redactTenantAuditData } from '../../../server/utils/tenant-audit-redaction'

const before = {
  id: 't-1', fullName: 'Khách Giả Lập', phone: '0901234567', idNumber: '012345678901',
  dateOfBirth: '1990-01-01', permanentAddress: 'Địa chỉ giả lập', idIssuedDate: '2020-01-01',
  idIssuedPlace: 'Nơi cấp giả lập', emergencyContactName: 'Người thân', emergencyContactPhone: '0907654321',
}

describe('redactTenantAuditData', () => {
  it('masks the id number and hides other identity fields on create', () => {
    const { before: b, after } = redactTenantAuditData(null, before)
    expect(b).toBeNull()
    expect(after).toMatchObject({
      fullName: 'Khách Giả Lập', phone: '0901234567', idNumber: '•••• 8901',
      dateOfBirth: '[đã ẩn]', permanentAddress: '[đã ẩn]', emergencyContactPhone: '[đã ẩn]',
    })
    expect(JSON.stringify(after)).not.toContain('012345678901')
    expect(JSON.stringify(after)).not.toContain('Địa chỉ giả lập')
  })

  it('marks changed hidden fields so history still shows a diff', () => {
    const { before: b, after } = redactTenantAuditData(before, { ...before, permanentAddress: 'Địa chỉ mới' })
    expect((b as Record<string, unknown>).permanentAddress).toBe('[đã ẩn]')
    expect((after as Record<string, unknown>).permanentAddress).toBe('[đã ẩn · đã thay đổi]')
    expect((after as Record<string, unknown>).dateOfBirth).toBe('[đã ẩn]')
  })

  it('flags an id number change even when the last four digits match', () => {
    const { after } = redactTenantAuditData(before, { ...before, idNumber: '999999998901' })
    expect((after as Record<string, unknown>).idNumber).toBe('•••• 8901 · đã thay đổi')
  })

  it('handles snake_case portal payloads and keeps nulls', () => {
    const { after } = redactTenantAuditData(null, { id_number: '012345678901', date_of_birth: null })
    expect(after).toEqual({ id_number: '•••• 8901', date_of_birth: null })
  })
})
