import { z } from 'zod'

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
