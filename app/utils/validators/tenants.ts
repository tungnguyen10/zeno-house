import { z } from 'zod'

export const tenantStatusSchema = z.enum(['active', 'archived'])
export const tenantSortFieldSchema = z.enum(['full_name', 'created_at', 'code'])
export const tenantSortOrderSchema = z.enum(['asc', 'desc'])

const toArray = <T>(value: T | T[] | undefined): T[] | undefined => {
  if (value === undefined) return undefined
  return Array.isArray(value) ? value : [value]
}

export const tenantCreateSchema = z.object({
  full_name: z.string().min(1, 'Họ tên không được trống').max(100, 'Họ tên quá dài'),
  phone: z.string().min(1, 'Số điện thoại không được trống').max(20, 'Số điện thoại quá dài'),
  email: z.string().email('Email không hợp lệ').nullable().optional(),
  id_number: z.string().max(20, 'Số CMND/CCCD quá dài').nullable().optional(),
  date_of_birth: z.string().nullable().optional(),
  permanent_address: z.string().max(300, 'Địa chỉ quá dài').nullable().optional(),
  notes: z.string().max(500, 'Ghi chú quá dài').nullable().optional(),
  gender: z.enum(['male', 'female', 'other']).nullable().optional(),
  occupation: z.string().max(100, 'Nghề nghiệp quá dài').nullable().optional(),
  id_issued_date: z.string().nullable().optional(),
  id_issued_place: z.string().max(200, 'Nơi cấp quá dài').nullable().optional(),
  emergency_contact_name: z.string().max(100, 'Tên liên hệ khẩn cấp quá dài').nullable().optional(),
  emergency_contact_phone: z.string().max(20, 'SĐT liên hệ khẩn cấp quá dài').nullable().optional(),
})

export const tenantUpdateSchema = tenantCreateSchema.partial()

export type TenantCreateInput = z.infer<typeof tenantCreateSchema>
export type TenantUpdateInput = z.infer<typeof tenantUpdateSchema>

export const tenantListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(20),
  q: z.preprocess(
    v => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().min(1).max(100).optional(),
  ),
  building_id: z.preprocess(
    v => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().min(1).optional(),
  ),
  contract_state: z.preprocess(
    v => (v === '' || v === undefined ? undefined : v),
    z.enum(['with_contract', 'without_contract']).optional(),
  ),
  status: z.preprocess(toArray, z.array(tenantStatusSchema).min(1).optional()),
  sort: tenantSortFieldSchema.optional().default('full_name'),
  order: tenantSortOrderSchema.optional().default('asc'),
  available: z.preprocess(
    v => (v === 'true' || v === true ? true : v === 'false' || v === false ? false : undefined),
    z.boolean().optional(),
  ),
  excludeContractId: z.preprocess(
    v => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().min(1).optional(),
  ),
})

export type TenantListQuery = z.infer<typeof tenantListQuerySchema>

export const tenantBulkActionSchema = z.object({
  action: z.enum(['archive', 'activate', 'delete']),
  ids: z.array(z.string().min(1)).min(1, 'Cần chọn ít nhất một khách thuê'),
  reason: z.string().trim().min(1, 'Lý do xoá là bắt buộc').max(500, 'Lý do quá dài').optional(),
  building_id: z.string().uuid('Building không hợp lệ').optional(),
}).refine(
  data => data.action !== 'delete' || Boolean(data.reason),
  { message: 'Lý do xoá là bắt buộc', path: ['reason'] },
)

export const tenantDeleteSchema = z.object({
  reason: z.string().trim().min(1, 'Lý do xoá là bắt buộc').max(500, 'Lý do quá dài'),
  building_id: z.string().uuid('Building không hợp lệ').optional(),
})

export type TenantBulkActionInput = z.infer<typeof tenantBulkActionSchema>
export type TenantDeleteInput = z.infer<typeof tenantDeleteSchema>
