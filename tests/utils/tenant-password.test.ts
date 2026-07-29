import { describe, expect, it } from 'vitest'
import { tenantPasswordChangeSchema } from '~/utils/validators/tenant-portal'

const valid = {
  current_password: 'mat-khau-cu',
  password: 'mat-khau-moi',
  password_confirmation: 'mat-khau-moi',
}

describe('tenant password change validator', () => {
  it('accepts a current password and matching valid new passwords', () => {
    expect(tenantPasswordChangeSchema.parse(valid)).toEqual(valid)
  })

  it('rejects mismatched confirmation', () => {
    const result = tenantPasswordChangeSchema.safeParse({
      ...valid,
      password_confirmation: 'mat-khau-khac',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.password_confirmation?.[0])
        .toBe('Mật khẩu xác nhận không khớp')
    }
  })

  it('rejects short, long, and unchanged new passwords', () => {
    expect(tenantPasswordChangeSchema.safeParse({
      ...valid,
      password: 'ngan',
      password_confirmation: 'ngan',
    }).success).toBe(false)
    expect(tenantPasswordChangeSchema.safeParse({
      ...valid,
      password: 'a'.repeat(73),
      password_confirmation: 'a'.repeat(73),
    }).success).toBe(false)
    expect(tenantPasswordChangeSchema.safeParse({
      ...valid,
      password: valid.current_password,
      password_confirmation: valid.current_password,
    }).success).toBe(false)
  })
})
