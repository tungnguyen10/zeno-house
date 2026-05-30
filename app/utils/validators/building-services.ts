import { z } from 'zod'

const pricingTypeEnum = z.enum(['fixed_per_room', 'per_person', 'per_vehicle'])

export const buildingServiceUpsertSchema = z.object({
  building_id: z.string().uuid(),
  catalog_id: z.string().uuid(),
  default_amount: z.number().min(0).optional(),
  pricing_type: pricingTypeEnum.nullable().optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
})

export const buildingServiceUpdateSchema = z.object({
  default_amount: z.number().min(0).optional(),
  pricing_type: pricingTypeEnum.nullable().optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
})

export type BuildingServiceUpsertInput = z.infer<typeof buildingServiceUpsertSchema>
export type BuildingServiceUpdateInput = z.infer<typeof buildingServiceUpdateSchema>
