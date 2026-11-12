import { z } from 'zod'
import { slugifyName } from '~/utils/format/slug'
import { booleanQuerySchema, limitSchema, orderSchema, pageSchema, searchQuerySchema, toArray } from './_shared'
import { selectAtLeastOne } from './messages'

const daySchema = z.number().int().min(1).max(31)

export const serviceFeeDefaultSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  pricing_type: z.enum(['fixed_per_room', 'per_vehicle', 'per_person']),
  amount: z.number().min(0),
  enabled: z.boolean(),
})

const buildingBaseSchema = z.object({
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
  operational_start_year: z.number().int().min(2000).max(2100).nullable().optional(),
  operational_start_month: z.number().int().min(1).max(12).nullable().optional(),
})

function validateOperationalStartPair(
  value: { operational_start_year?: number | null; operational_start_month?: number | null },
  ctx: z.RefinementCtx,
) {
  const hasYear = value.operational_start_year != null
  const hasMonth = value.operational_start_month != null

  if (hasYear === hasMonth) return

  if (!hasYear) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['operational_start_year'],
      message: 'Năm bắt đầu vận hành là bắt buộc khi đã chọn tháng.',
    })
  }
  if (!hasMonth) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['operational_start_month'],
      message: 'Tháng bắt đầu vận hành là bắt buộc khi đã chọn năm.',
    })
  }
}

export const buildingCreateSchema = buildingBaseSchema.superRefine(validateOperationalStartPair)

export const QUICK_ROOM_MAX = 200

export const quickRoomSchema = z.object({
  room_number: z.string().trim().min(1, 'Số phòng không được trống').max(20, 'Số phòng quá dài'),
  floor: z.number().int().min(1, 'Tầng phải >= 1').max(100, 'Tầng phải <= 100'),
  monthly_rent: z.number().min(0, 'Giá thuê không được âm'),
  area: z.number().positive('Diện tích phải > 0').nullable(),
})

export const buildingCreateWithRoomsSchema = buildingBaseSchema
  .extend({
    request_id: z.string().uuid('Mã yêu cầu không hợp lệ').optional(),
    rooms: z.array(quickRoomSchema).max(QUICK_ROOM_MAX, `Tối đa ${QUICK_ROOM_MAX} phòng mỗi lần`).optional(),
  })
  .superRefine(validateOperationalStartPair)
  .superRefine((value, ctx) => {
    const seen = new Set<string>()
    value.rooms?.forEach((room, index) => {
      const key = slugifyName(room.room_number) || room.room_number.toLowerCase()
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['rooms', index, 'room_number'],
          message: `Mã phòng "${room.room_number}" bị trùng`,
        })
      }
      seen.add(key)
    })
  })

export type QuickRoomInput = z.infer<typeof quickRoomSchema>
export type BuildingCreateWithRoomsInput = z.infer<typeof buildingCreateWithRoomsSchema>

export const buildingUpdateSchema = buildingBaseSchema.partial().extend({
  code: z.string().min(1).max(20).regex(/^[a-z0-9]+$/, 'Code chỉ được chứa chữ thường và số').optional(),
}).superRefine(validateOperationalStartPair)

export type BuildingCreateInput = z.infer<typeof buildingCreateSchema>
export type BuildingUpdateInput = z.infer<typeof buildingUpdateSchema>

export const buildingStatusSchema = z.enum(['active', 'inactive'])
export const buildingSortFieldSchema = z.enum(['name', 'created_at', 'total_rooms'])
export const buildingSortOrderSchema = orderSchema

export const buildingListQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema(100),
  q: searchQuerySchema,
  status: z.preprocess(toArray, z.array(buildingStatusSchema).min(1).optional()),
  include_hidden: booleanQuerySchema,
  sort: buildingSortFieldSchema.optional().default('created_at'),
  order: buildingSortOrderSchema.optional().default('desc'),
})

export type BuildingListQuery = z.infer<typeof buildingListQuerySchema>

export const buildingVisibilitySchema = z.object({
  is_hidden: z.boolean(),
})

export type BuildingVisibilityInput = z.infer<typeof buildingVisibilitySchema>

export const buildingBulkActionSchema = z.object({
  action: z.enum(['archive', 'activate', 'delete']),
  ids: z.array(z.string().min(1)).min(1, selectAtLeastOne('tòa nhà')),
})

export type BuildingBulkActionInput = z.infer<typeof buildingBulkActionSchema>
