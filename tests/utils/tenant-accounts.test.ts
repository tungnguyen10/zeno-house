import { describe, expect, it } from 'vitest'
import {
  tenantAccountProvisionSchema,
  tenantAccountStatusUpdateSchema,
} from '../../app/utils/validators/tenant-accounts'

describe('tenantAccountProvisionSchema', () => {
  it('accepts and normalizes a valid email', () => {
    const result = tenantAccountProvisionSchema.safeParse({ email: '  Tenant@Example.COM ' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.email).toBe('tenant@example.com')
  })

  it('rejects an invalid email', () => {
    expect(tenantAccountProvisionSchema.safeParse({ email: 'not-an-email' }).success).toBe(false)
  })
})

describe('tenantAccountStatusUpdateSchema', () => {
  it.each(['active', 'disabled'] as const)('accepts %s', (status) => {
    expect(tenantAccountStatusUpdateSchema.safeParse({ status }).success).toBe(true)
  })

  it('rejects an unknown status', () => {
    expect(tenantAccountStatusUpdateSchema.safeParse({ status: 'deleted' }).success).toBe(false)
  })
})
