import { describe, expect, it } from 'vitest'
import fixture from '../__fixtures__/tenant-identity-normalization.json'
import { normalizeTenantIdNumber, normalizeTenantPhone } from '~/utils/tenant-identity'
import { tenantCreateSchema, tenantUpdateSchema } from '~/utils/validators/tenants'
import { tenantProfileUpdateSchema } from '~/utils/validators/tenant-portal'

describe('normalizeTenantPhone', () => {
  it.each(fixture.phone)('$input -> $expected', ({ input, expected }) => {
    expect(normalizeTenantPhone(input)).toBe(expected)
  })
})

describe('normalizeTenantIdNumber', () => {
  it.each(fixture.idNumber)('$input -> $expected', ({ input, expected }) => {
    expect(normalizeTenantIdNumber(input)).toBe(expected)
  })
})

describe('tenant validators normalize identity fields', () => {
  it('stores normalized phone and id number on create', () => {
    const result = tenantCreateSchema.parse({ full_name: 'Khách Giả Lập', phone: '+84 90 123 4567', id_number: ' 0123 4567 8901 ' })
    expect(result.phone).toBe('0901234567')
    expect(result.id_number).toBe('012345678901')
  })

  it('rejects an invalid phone with a field error', () => {
    const result = tenantCreateSchema.safeParse({ full_name: 'Khách Giả Lập', phone: '090123' })
    expect(result.success).toBe(false)
    expect(result.error?.flatten().fieldErrors.phone).toEqual(['Số điện thoại không hợp lệ'])
  })

  it('leaves omitted fields undefined on partial update', () => {
    expect(tenantUpdateSchema.parse({ full_name: 'Khách Giả Lập' })).toEqual({ full_name: 'Khách Giả Lập' })
  })

  it('normalizes portal profile identity fields', () => {
    expect(tenantProfileUpdateSchema.parse({ phone: '0901.234.567', id_number: 'b1234567' }))
      .toEqual({ phone: '0901234567', id_number: 'B1234567' })
  })
})

describe('tenant identity validator boundaries', () => {
  it('normalizes blank identity numbers to null while preserving omitted values', () => {
    expect(tenantUpdateSchema.parse({ id_number: '   ' })).toEqual({ id_number: null })
    expect(tenantUpdateSchema.parse({ id_number: null })).toEqual({ id_number: null })
    expect(tenantUpdateSchema.parse({ id_number: undefined })).toEqual({ id_number: undefined })
    expect(normalizeTenantIdNumber(undefined)).toBeNull()
  })

  it('retains existing required and maximum-length validation', () => {
    expect(tenantCreateSchema.safeParse({ full_name: 'Khách Giả Lập', phone: '' }).error?.flatten().fieldErrors.phone)
      .toEqual(['Số điện thoại không được trống'])
    expect(tenantUpdateSchema.safeParse({ id_number: 'X'.repeat(21) }).success).toBe(false)
    expect(tenantProfileUpdateSchema.safeParse({ phone: null }).success).toBe(false)
    expect(tenantProfileUpdateSchema.safeParse({}).success).toBe(false)
  })

  it.each(['+01234567', '+123456', '+1234567890123456', '0901/234/567', '0901abc234567', '++84901234567'])(
    'rejects unsupported phone %s', (phone) => {
      expect(normalizeTenantPhone(phone)).toBeNull()
      expect(tenantUpdateSchema.safeParse({ phone }).success).toBe(false)
    },
  )

  it.each(['+12345678', '+123456789012345'])('accepts international boundary phone %s', (phone) => {
    expect(normalizeTenantPhone(phone)).toBe(phone)
  })
})
