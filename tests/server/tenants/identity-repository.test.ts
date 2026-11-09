import { describe, expect, it, vi } from 'vitest'
import { TenantIdentityUniqueViolation, throwIfTenantIdentityViolation } from '../../../server/repositories/tenants/identity-errors'

vi.mock('../../../server/utils/db', () => ({ db: vi.fn() }))

describe('throwIfTenantIdentityViolation', () => {
  it('maps the phone index to a typed violation', () => {
    expect(() => throwIfTenantIdentityViolation({ code: '23505', message: 'duplicate key value violates unique constraint "tenants_phone_uq"' }))
      .toThrowError(expect.objectContaining({ field: 'phone' }))
  })

  it('maps the id number index from details too', () => {
    try {
      throwIfTenantIdentityViolation({ code: '23505', message: 'duplicate key', details: 'Key (id_number)=(X) already exists. tenants_id_number_uq' })
      throw new Error('expected throw')
    }
    catch (error) {
      expect(error).toBeInstanceOf(TenantIdentityUniqueViolation)
      expect((error as TenantIdentityUniqueViolation).field).toBe('id_number')
    }
  })

  it('ignores other unique violations and other errors', () => {
    expect(() => throwIfTenantIdentityViolation({ code: '23505', message: 'tenants_code_uq' })).not.toThrow()
    expect(() => throwIfTenantIdentityViolation({ code: '42501', message: 'tenants_phone_uq' })).not.toThrow()
    expect(() => throwIfTenantIdentityViolation(null)).not.toThrow()
  })
})

// Mutation errors are injected at the persistence boundary so these assertions
// exercise each repository's translation, rather than just the helper above.
describe('repository identity error boundaries', () => {
  it.each(['insert', 'insertMany', 'update', 'portal'] as const)('translates %s identity unique violations', async (operation) => {
    const { vi } = await import('vitest')
    const { db } = await import('../../../server/utils/db')
    const error = { code: '23505', message: 'duplicate key violates unique constraint "tenants_phone_uq"' }
    const result = { data: null, error }
    let writing = false
    const query: Record<string, unknown> = {}
    for (const method of ['select', 'eq', 'like', 'ilike']) query[method] = () => query
    query.insert = query.update = () => { writing = true; return query }
    query.single = () => Promise.resolve(result)
    query.then = (resolve: (value: unknown) => unknown) => Promise.resolve(writing ? result : { data: [], error: null }).then(resolve)
    vi.mocked(db).mockReturnValue({ from: () => query } as never)
    const { TenantRepository } = await import('../../../server/repositories/tenants')
    const { TenantProfileRepository } = await import('../../../server/repositories/tenant-portal/profile')
    const event = {} as never
    const input = { full_name: 'Fictional Tenant', phone: '0900000000' }
    const action = operation === 'insert' ? TenantRepository.insert(event, input)
      : operation === 'insertMany' ? TenantRepository.insertMany(event, [input])
        : operation === 'update' ? TenantRepository.update(event, 't-self', input)
          : TenantProfileRepository.updateByTenantId(event, 't-self', input)
    await expect(action).rejects.toBeInstanceOf(TenantIdentityUniqueViolation)
    await expect(action).rejects.toMatchObject({ field: 'phone', message: 'TENANT_IDENTITY_UNIQUE_VIOLATION' })
  })
})
