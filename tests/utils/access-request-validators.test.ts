import { describe, expect, it } from 'vitest'
import {
  accessRequestApprovalSchema,
  accessRequestRejectionSchema,
  authRegistrationSchema,
} from '../../app/utils/validators/access-requests'

describe('access request validators', () => {
  it('requires at least one building for internal approval', () => {
    const result = accessRequestApprovalSchema.safeParse({ role: 'manager', building_ids: [] })
    expect(result.success).toBe(false)
  })

  it('accepts a tenant approval with one tenant id', () => {
    const result = accessRequestApprovalSchema.safeParse({
      role: 'tenant',
      tenant_id: '00000000-0000-4000-8000-000000000001',
    })
    expect(result.success).toBe(true)
  })

  it('requires a meaningful rejection reason', () => {
    expect(accessRequestRejectionSchema.safeParse({ reason: '  ' }).success).toBe(false)
    expect(accessRequestRejectionSchema.safeParse({ reason: 'Không xác minh được tài khoản.' }).success).toBe(true)
  })

  it('requires matching registration passwords', () => {
    const result = authRegistrationSchema.safeParse({
      full_name: 'Nguyễn Văn A',
      email: 'a@example.com',
      password: 'password-123',
      password_confirmation: 'different-123',
    })
    expect(result.success).toBe(false)
  })
})
