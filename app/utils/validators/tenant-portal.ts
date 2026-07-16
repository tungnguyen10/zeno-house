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

export const tenantProfileUpdateSchema = z.object({
  phone: z.string().trim().min(1).max(20).optional(),
  email: z.string().trim().email().nullable().optional(),
  emergency_contact_name: z.string().trim().max(100).nullable().optional(),
  emergency_contact_phone: z.string().trim().max(20).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
}).refine(input => Object.keys(input).length > 0, {
  message: 'Cần ít nhất một trường hồ sơ hợp lệ',
})

export const tenantInvoiceListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
})

export type TenantProfileUpdateInput = z.infer<typeof tenantProfileUpdateSchema>
export type TenantInvoiceListQuery = z.infer<typeof tenantInvoiceListQuerySchema>
export type TenantDocumentUploadMetadata = z.infer<typeof tenantDocumentUploadSchema>
export type TenantIdentityImageSide = z.infer<typeof tenantIdentityImageSideSchema>
