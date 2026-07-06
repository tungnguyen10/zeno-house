import { z } from 'zod'

const pricingTypeEnum = z.enum(['fixed_per_room', 'per_person', 'per_vehicle'])

export const serviceCatalogListQuerySchema = z.object({
  building_id: z.string().min(1).optional(),
})

export const serviceCatalogCreateSchema = z.object({
  building_id: z.string().min(1, 'building_id không được để trống'),
  name: z.string().trim().min(1, 'Tên dịch vụ là bắt buộc').max(120, 'Tên dịch vụ quá dài'),
  pricing_type: pricingTypeEnum.default('fixed_per_room'),
  unit: z.string().trim().max(40, 'Đơn vị quá dài').nullable().optional(),
  description: z.string().trim().max(500, 'Mô tả quá dài').nullable().optional(),
})

export type ServiceCatalogListQuery = z.infer<typeof serviceCatalogListQuerySchema>
export type ServiceCatalogCreateInput = z.infer<typeof serviceCatalogCreateSchema>
