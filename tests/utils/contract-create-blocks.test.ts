import { describe, expect, it } from 'vitest'
import { blockForField } from '~/utils/contracts/contract-create-blocks'

describe('blockForField', () => {
  it.each([
    ['occupants.1.tenant_id', 'occupants'],
    ['vehicles.0.plate_number', 'vehicles'],
    ['services.2.amount', 'services'],
    ['inventory.0.name', 'inventory'],
    ['monthly_rent', 'terms'],
    ['handover_water_reading', 'handover'],
    ['handover_electricity_reading', 'handover'],
    ['tenant_id', 'tenant'],
    ['room_id', 'room'],
    ['CONTRACT_OCCUPANT_BUSY', 'occupants'],
    ['CONTRACT_VEHICLE_DUPLICATE', 'vehicles'],
    ['CONTRACT_SERVICE_INVALID', 'services'],
  ])('maps %s → %s', (field, block) => {
    expect(blockForField(field)).toBe(block)
  })
})
