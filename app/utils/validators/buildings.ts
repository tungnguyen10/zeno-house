import { z } from 'zod'

const daySchema = z.number().int().min(1).max(31)

export const serviceFeeDefaultSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  pricing_type: z.enum(['fixed_per_room', 'per_vehicle', 'per_person']),
  amount: z.number().min(0),
  enabled: z.boolean(),
})

export const buildingCreateSchema = z.object({
  name: z.string().min(2, 'Tên tòa nhà phải có ít nhất 2 ký tự').max(100, 'Tên quá dài'),
  slug: z.string().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  address: z.string().min(5, 'Địa chỉ phải có ít nhất 5 ký tự').max(200, 'Địa chỉ quá dài'),
  description: z.string().max(500, 'Mô tả quá dài').nullable().optional(),
  status: z.enum(['active', 'inactive']).optional().default('active'),
  // Owner/contact
  owner_name: z.string().max(100).nullable().optional(),
  owner_phone: z.string().max(20).nullable().optional(),
  owner_email: z.string().email('Email không hợp lệ').nullable().optional(),
  // Billing defaults
  electricity_pricing_type: z.enum(['per_kwh', 'fixed', 'tiered']).optional().default('per_kwh'),
  default_electricity_rate: z.number().min(0).nullable().optional(),
  water_pricing_type: z.enum(['per_m3', 'per_person', 'fixed_per_room']).optional().default('per_m3'),
  default_water_rate: z.number().min(0).nullable().optional(),
  // Schedule
  meter_reading_day: daySchema.nullable().optional(),
  billing_generation_day: daySchema.nullable().optional(),
  payment_due_day: daySchema.nullable().optional(),
  grace_period_days: z.number().int().min(0).optional().default(0),
})

export const buildingUpdateSchema = buildingCreateSchema.partial().extend({
  code: z.string().min(1).max(20).regex(/^[a-z0-9]+$/, 'Code chỉ được chứa chữ thường và số').optional(),
})

export type BuildingCreateInput = z.infer<typeof buildingCreateSchema>
export type BuildingUpdateInput = z.infer<typeof buildingUpdateSchema>

export const buildingStatusSchema = z.enum(['active', 'inactive'])
export const buildingSortFieldSchema = z.enum(['name', 'created_at', 'total_rooms'])
export const buildingSortOrderSchema = z.enum(['asc', 'desc'])

const toArray = <T>(value: T | T[] | undefined): T[] | undefined => {
  if (value === undefined) return undefined
  return Array.isArray(value) ? value : [value]
}

export const buildingListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  q: z.preprocess(
    v => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().min(1).max(100).optional(),
  ),
  status: z.preprocess(toArray, z.array(buildingStatusSchema).min(1).optional()),
  sort: buildingSortFieldSchema.optional().default('created_at'),
  order: buildingSortOrderSchema.optional().default('desc'),
})

export type BuildingListQuery = z.infer<typeof buildingListQuerySchema>

export const buildingBulkActionSchema = z.object({
  action: z.enum(['archive', 'activate', 'delete']),
  ids: z.array(z.string().min(1)).min(1, 'Cần chọn ít nhất một tòa nhà'),
})

export type BuildingBulkActionInput = z.infer<typeof buildingBulkActionSchema>
