import { z } from 'zod'
import { contractVehicleListSchema } from './contract-vehicles'
import { inventoryListSchema } from './inventory'

// Draft payload: every field optional, strict so stray identity keys (CCCD, dob…)
// from the quick-create dialog can never be persisted to the server draft.
const draftOccupantSchema = z.object({
  tenant_id: z.string().uuid().optional(),
  tenant_name: z.string().max(100).optional(),
  move_in_date: z.string().optional(),
  billing_counted: z.boolean().optional(),
}).strict()

const draftServiceSchema = z.object({
  catalog_id: z.string().uuid().optional(),
  amount: z.number().optional(),
  quantity: z.number().optional(),
  is_enabled: z.boolean().optional(),
  notes: z.string().nullable().optional(),
}).strict()

export const contractCreateDraftSchema = z.object({
  room_id: z.string().optional(),
  tenant_id: z.string().optional(),
  tenant_name: z.string().max(100).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  monthly_rent: z.union([z.string(), z.number()]).optional(),
  deposit: z.union([z.string(), z.number()]).optional(),
  payment_due_day: z.number().nullable().optional(),
  occupant_count: z.number().optional(),
  notes: z.string().max(500).nullable().optional(),
  handover_electricity_reading: z.union([z.string(), z.number()]).optional(),
  handover_water_reading: z.union([z.string(), z.number()]).optional(),
  handover_reading_date: z.string().optional(),
  occupants: z.array(draftOccupantSchema).max(10).optional(),
  vehicles: contractVehicleListSchema.optional(),
  services: z.array(draftServiceSchema).optional(),
  inventory: inventoryListSchema.optional(),
  open_blocks: z.array(z.string()).optional(),
}).strict()

export type ContractCreateDraftInput = z.infer<typeof contractCreateDraftSchema>
