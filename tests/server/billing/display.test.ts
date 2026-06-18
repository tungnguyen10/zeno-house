import { vi } from 'vitest'
import { BillingDisplayResolver } from '../../../server/services/billing/display'

const getUserById = vi.hoisted(() => vi.fn())

vi.mock('#supabase/server', () => ({
  serverSupabaseClient: vi.fn(),
  serverSupabaseServiceRole: vi.fn(() => ({
    auth: {
      admin: {
        getUserById,
      },
    },
  })),
}))

describe('BillingDisplayResolver actor display', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves actor display name and email from Supabase Auth users', async () => {
    getUserById.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'manager@example.com',
          user_metadata: { full_name: 'Manager One' },
        },
      },
      error: null,
    })

    const resolver = new BillingDisplayResolver({} as never)
    const actors = await resolver.loadActors(['user-1'])

    expect(actors.get('user-1')).toEqual({
      id: 'user-1',
      name: 'Manager One',
      email: 'manager@example.com',
    })
    expect(resolver.stats()).toEqual({ 'auth.users': 1 })
  })

  it('falls back safely for unresolved actors', async () => {
    getUserById.mockResolvedValue({ data: { user: null }, error: { message: 'not found' } })

    const resolver = new BillingDisplayResolver({} as never)
    const actors = await resolver.loadActors(['missing-user'])

    expect(actors.get('missing-user')).toEqual({
      id: 'missing-user',
      name: null,
      email: null,
    })
  })

  it('enriches payment recorder display names', async () => {
    getUserById.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'cashier@example.com',
          user_metadata: { name: 'Cashier One' },
        },
      },
      error: null,
    })

    const resolver = new BillingDisplayResolver({} as never)
    const [payment] = await resolver.enrichPayments([{ id: 'payment-1', recordedBy: 'user-1' }])

    expect(payment?.recordedByName).toBe('Cashier One')
  })
})
