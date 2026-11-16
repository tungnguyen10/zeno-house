export type TenantIdentityField = 'phone' | 'id_number'

export class TenantIdentityUniqueViolation extends Error {
  constructor(readonly field: TenantIdentityField) {
    super('TENANT_IDENTITY_UNIQUE_VIOLATION')
    this.name = 'TenantIdentityUniqueViolation'
  }
}

export function throwIfTenantIdentityViolation(error: unknown): void {
  if (!error || typeof error !== 'object') return
  const record = error as { code?: unknown; message?: unknown; details?: unknown }
  if (record.code !== '23505') return
  const text = `${String(record.message ?? '')} ${String(record.details ?? '')}`
  if (text.includes('tenants_phone_uq')) throw new TenantIdentityUniqueViolation('phone')
  if (text.includes('tenants_id_number_uq')) throw new TenantIdentityUniqueViolation('id_number')
}
