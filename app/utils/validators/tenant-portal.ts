import { z } from 'zod'
import { tenantIdImageSideSchema } from './tenants'

export const TENANT_DOCUMENT_MAX_BYTES = 5 * 1024 * 1024
export const TENANT_DOCUMENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const

export const tenantDocumentUploadSchema = z.object({
  name: z.string().trim().min(1).max(255),
  mimeType: z.enum(TENANT_DOCUMENT_MIME_TYPES),
  size: z.number().int().positive().max(TENANT_DOCUMENT_MAX_BYTES),
})

export const tenantSupportRequestCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5000),
  attachment: tenantDocumentUploadSchema.optional(),
})

export const tenantIdentityImageSideSchema = tenantIdImageSideSchema
export const TENANT_IDENTITY_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

export const tenantIdentityImageUploadSchema = z.object({
  mimeType: z.enum(TENANT_IDENTITY_IMAGE_MIME_TYPES),
  size: z.number().int().positive().max(TENANT_DOCUMENT_MAX_BYTES),
})

const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ')
  .nullable()
  .optional()

export const tenantProfileUpdateSchema = z.object({
  full_name: z.string().trim().min(1, 'Họ tên không được trống').max(100, 'Họ tên quá dài').optional(),
  phone: z.string().trim().min(1, 'Số điện thoại không được trống').max(20, 'Số điện thoại quá dài').optional(),
  gender: z.enum(['male', 'female', 'other']).nullable().optional(),
  date_of_birth: isoDateSchema,
  occupation: z.string().trim().max(100, 'Nghề nghiệp quá dài').nullable().optional(),
  permanent_address: z.string().trim().max(300, 'Địa chỉ quá dài').nullable().optional(),
  id_number: z.string().trim().max(20, 'Số CCCD/CMND quá dài').nullable().optional(),
  id_issued_date: isoDateSchema,
  id_issued_place: z.string().trim().max(200, 'Nơi cấp quá dài').nullable().optional(),
  emergency_contact_name: z.string().trim().max(100, 'Tên liên hệ khẩn cấp quá dài').nullable().optional(),
  emergency_contact_phone: z.string().trim().max(20, 'SĐT khẩn cấp quá dài').nullable().optional(),
  notes: z.string().trim().max(500, 'Ghi chú quá dài').nullable().optional(),
}).refine(input => Object.keys(input).length > 0, {
  message: 'Cần ít nhất một trường hồ sơ hợp lệ',
})

const tenantPasswordSchema = z
  .string()
  .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
  .max(72, 'Mật khẩu không được vượt quá 72 ký tự')

export const tenantPasswordChangeSchema = z.object({
  current_password: tenantPasswordSchema,
  password: tenantPasswordSchema,
  password_confirmation: tenantPasswordSchema,
}).superRefine((input, context) => {
  if (input.password !== input.password_confirmation) {
    context.addIssue({
      code: 'custom',
      path: ['password_confirmation'],
      message: 'Mật khẩu xác nhận không khớp',
    })
  }
  if (input.password === input.current_password) {
    context.addIssue({
      code: 'custom',
      path: ['password'],
      message: 'Mật khẩu mới phải khác mật khẩu hiện tại',
    })
  }
})

export const tenantInvoiceListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
})

export type TenantProfileUpdateInput = z.infer<typeof tenantProfileUpdateSchema>
export type TenantPasswordChangeInput = z.infer<typeof tenantPasswordChangeSchema>
export type TenantInvoiceListQuery = z.infer<typeof tenantInvoiceListQuerySchema>
export type TenantDocumentUploadMetadata = z.infer<typeof tenantDocumentUploadSchema>
export type TenantSupportRequestCreateInput = z.infer<typeof tenantSupportRequestCreateSchema>
export type TenantIdentityImageSide = z.infer<typeof tenantIdentityImageSideSchema>
