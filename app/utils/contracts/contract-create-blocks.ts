export type ContractCreateBlock = 'room' | 'tenant' | 'terms' | 'handover' | 'occupants' | 'vehicles' | 'services' | 'inventory'

const COLLECTION_BLOCKS = new Set<ContractCreateBlock>(['occupants', 'vehicles', 'services', 'inventory'])
const HANDOVER_FIELDS = new Set(['handover_electricity_reading', 'handover_water_reading', 'handover_reading_date'])

// Server 409 domain reasons mapped to the block that should open + scroll into view.
const REASON_BLOCKS: Record<string, ContractCreateBlock> = {
  CONTRACT_OCCUPANT_BUSY: 'occupants',
  CONTRACT_OCCUPANT_LIMIT: 'occupants',
  CONTRACT_OCCUPANT_PRIMARY: 'occupants',
  CONTRACT_VEHICLE_DUPLICATE: 'vehicles',
  CONTRACT_SERVICE_INVALID: 'services',
}

/**
 * Map a validation field path (e.g. `occupants.1.tenant_id`) or a server domain
 * reason (e.g. `CONTRACT_OCCUPANT_BUSY`) to the create-page block that contains it,
 * so the page can open a collapsed block and scroll to the first error.
 */
export function blockForField(field: string): ContractCreateBlock {
  if (REASON_BLOCKS[field]) return REASON_BLOCKS[field]
  const head = field.split('.')[0] ?? field
  if (COLLECTION_BLOCKS.has(head as ContractCreateBlock)) return head as ContractCreateBlock
  if (HANDOVER_FIELDS.has(field)) return 'handover'
  if (field === 'room_id') return 'room'
  if (field === 'tenant_id') return 'tenant'
  return 'terms'
}
