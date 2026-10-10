import { describe, expect, it } from 'vitest'
import { collectCurrentTenantAssignments } from '../../../server/repositories/tenants/export'

describe('tenant export roster', () => {
  it('includes current primary tenants and roommates in the chosen building only', () => {
    const assignments = collectCurrentTenantAssignments(
      [
        { id: 'c-1', tenant_id: 'primary', room_id: 'r-1', start_date: '2026-01-01', room_number: '101' },
        { id: 'c-2', tenant_id: 'future', room_id: 'r-2', start_date: '2026-11-01', room_number: '102' },
      ],
      [
        { contract_id: 'c-1', tenant_id: 'roommate', move_in_date: '2026-02-01', move_out_date: null },
        { contract_id: 'c-1', tenant_id: 'moved-out', move_in_date: '2026-02-01', move_out_date: '2026-09-30' },
        { contract_id: 'c-1', tenant_id: 'future-roommate', move_in_date: '2026-11-01', move_out_date: null },
      ],
      '2026-10-10',
    )

    expect(assignments).toEqual([
      { tenantId: 'primary', roomNumbers: ['101'], roles: ['primary'] },
      { tenantId: 'roommate', roomNumbers: ['101'], roles: ['roommate'] },
    ])
  })
})
