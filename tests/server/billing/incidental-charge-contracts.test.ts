import { describe, expect, it } from 'vitest'
import {
  incidentalChargeCreateSchema,
  incidentalChargeDeleteSchema,
  incidentalChargeUpdateSchema,
} from '~/utils/validators/billing'
import { mapBillingIncidentalCharge } from '~/utils/mappers/billing'
import { CHARGE_TYPES } from '~/utils/constants/billing'

const ids = {
  charge: '10000000-0000-4000-8000-000000000001',
  period: '10000000-0000-4000-8000-000000000002',
  contract: '10000000-0000-4000-8000-000000000003',
  room: '10000000-0000-4000-8000-000000000004',
  actor: '10000000-0000-4000-8000-000000000005',
  operation: '10000000-0000-4000-8000-000000000006',
}

describe('incidental charge wire contracts', () => {
  it('registers incidental as a first-class invoice charge type', () => {
    expect(CHARGE_TYPES).toContain('incidental')
  })

  it('normalizes a valid positive free-text charge', () => {
    expect(incidentalChargeCreateSchema.parse({
      contract_id: ids.contract,
      label: '  Làm mất chìa khóa  ',
      amount: 150_000,
      note: '  Cấp lại hai chìa  ',
      operation_id: ids.operation,
    })).toEqual({
      contract_id: ids.contract,
      label: 'Làm mất chìa khóa',
      amount: 150_000,
      note: 'Cấp lại hai chìa',
      operation_id: ids.operation,
    })
  })

  it.each([0, -1, 1.5, 1_000_000_000_000])('rejects unsupported amount %s', (amount) => {
    expect(incidentalChargeCreateSchema.safeParse({
      contract_id: ids.contract,
      label: 'Phí phát sinh',
      amount,
      operation_id: ids.operation,
    }).success).toBe(false)
  })

  it('requires a meaningful update and optimistic versions', () => {
    expect(incidentalChargeUpdateSchema.safeParse({
      expected_updated_at: '2026-08-05T10:00:00.000Z',
    }).success).toBe(false)
    expect(incidentalChargeDeleteSchema.parse({
      expected_updated_at: '2026-08-05T10:00:00.000Z',
    })).toEqual({ expected_updated_at: '2026-08-05T10:00:00.000Z' })
  })
})

describe('mapBillingIncidentalCharge', () => {
  it('maps numeric database values to the public DTO', () => {
    expect(mapBillingIncidentalCharge({
      id: ids.charge,
      billing_period_id: ids.period,
      contract_id: ids.contract,
      room_id: ids.room,
      label: 'Làm mất chìa khóa',
      amount: '150000',
      note: null,
      operation_id: ids.operation,
      created_by: ids.actor,
      created_at: '2026-08-05T10:00:00.000Z',
      updated_at: '2026-08-05T10:00:00.000Z',
    })).toEqual({
      id: ids.charge,
      billingPeriodId: ids.period,
      contractId: ids.contract,
      roomId: ids.room,
      label: 'Làm mất chìa khóa',
      amount: 150_000,
      note: null,
      operationId: ids.operation,
      createdBy: ids.actor,
      createdAt: '2026-08-05T10:00:00.000Z',
      updatedAt: '2026-08-05T10:00:00.000Z',
    })
  })
})
