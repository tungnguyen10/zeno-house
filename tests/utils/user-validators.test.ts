import { describe, expect, it } from 'vitest'
import { userCreateSchema } from '../../app/utils/validators/users'

describe('userCreateSchema role boundary', () => {
  it('rejects tenant accounts from internal user management', () => {
    const result = userCreateSchema.safeParse({
      email: 'tenant@zeno.test',
      password: 'password123',
      role: 'tenant',
      building_ids: [],
    })

    expect(result.success).toBe(false)
  })
})
