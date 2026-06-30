import { z } from 'zod'

const pricingTypeEnum = z.enum(['fixed_per_room', 'per_person', 'per_vehicle'])

export const buildingServiceUpsertSchema = z.object({
  building_id: z.string().min(1),
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

export const buildingServiceDeleteSchema = z.object({
  reason: z.string().trim().min(1, 'Lý do xoá là bắt buộc').max(500, 'Lý do quá dài'),
})

export type BuildingServiceUpsertInput = z.infer<typeof buildingServiceUpsertSchema>
export type BuildingServiceUpdateInput = z.infer<typeof buildingServiceUpdateSchema>
export type BuildingServiceDeleteInput = z.infer<typeof buildingServiceDeleteSchema>
