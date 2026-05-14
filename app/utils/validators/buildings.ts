import { z } from 'zod'

export const buildingCreateSchema = z.object({
  name: z.string().min(2, 'Tên tòa nhà phải có ít nhất 2 ký tự').max(100, 'Tên quá dài'),
  address: z.string().min(5, 'Địa chỉ phải có ít nhất 5 ký tự').max(200, 'Địa chỉ quá dài'),
  description: z.string().max(500, 'Mô tả quá dài').nullable().optional(),
  status: z.enum(['active', 'inactive']).optional().default('active'),
})

export const buildingUpdateSchema = buildingCreateSchema.partial()

export type BuildingCreateInput = z.infer<typeof buildingCreateSchema>
export type BuildingUpdateInput = z.infer<typeof buildingUpdateSchema>
