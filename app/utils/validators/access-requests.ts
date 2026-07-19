import { z } from 'zod'
import { ROLES } from '~/utils/constants/roles'

const uuid = z.string().uuid('Định danh không hợp lệ')
const password = z.string()
  .min(8, 'Mật khẩu tối thiểu 8 ký tự')
  .max(72, 'Mật khẩu tối đa 72 ký tự')

export const accessRequestStatusSchema = z.enum(['pending', 'processing', 'approved', 'rejected'])
export const accessRequestListQuerySchema = z.object({
  status: accessRequestStatusSchema.optional(),
})

const internalApprovalSchema = z.object({
  role: z.enum([ROLES.OWNER, ROLES.MANAGER]),
  building_ids: z.array(uuid).min(1, 'Chọn ít nhất một tòa nhà'),
})

const tenantApprovalSchema = z.object({
  role: z.literal(ROLES.TENANT),
  tenant_id: uuid,
})

export const accessRequestApprovalSchema = z.discriminatedUnion('role', [
  internalApprovalSchema,
  tenantApprovalSchema,
])

export const accessRequestRejectionSchema = z.object({
  reason: z.string().trim().min(3, 'Lý do tối thiểu 3 ký tự').max(500, 'Lý do tối đa 500 ký tự'),
})

export const authRegistrationSchema = z.object({
  full_name: z.string().trim().min(1, 'Họ tên là bắt buộc').max(120),
  email: z.string().trim().toLowerCase().email('Email không hợp lệ'),
  password,
  password_confirmation: password,
}).refine(value => value.password === value.password_confirmation, {
  path: ['password_confirmation'],
  message: 'Mật khẩu xác nhận không khớp',
})

export const authEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email không hợp lệ'),
})

export const authPasswordResetSchema = z.object({
  password,
  password_confirmation: password,
}).refine(value => value.password === value.password_confirmation, {
  path: ['password_confirmation'],
  message: 'Mật khẩu xác nhận không khớp',
})

export type AccessRequestApprovalInput = z.infer<typeof accessRequestApprovalSchema>
export type AccessRequestRejectionInput = z.infer<typeof accessRequestRejectionSchema>
export type AuthRegistrationInput = z.infer<typeof authRegistrationSchema>
export type AuthPasswordResetInput = z.infer<typeof authPasswordResetSchema>
