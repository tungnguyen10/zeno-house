import { z } from 'zod'

const documentType = z.enum(['contract', 'appendix'])
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ')

export const contractDocumentCheckSchema = z.object({
  type: documentType.default('contract'),
  amendment_id: z.string().uuid().nullable().optional(),
})

export const contractDocumentPreviewSchema = contractDocumentCheckSchema.extend({
  signed_date: isoDate,
})

export const contractDocumentIssueSchema = contractDocumentPreviewSchema.extend({
  request_id: z.string().uuid('Mã yêu cầu không hợp lệ'),
  replaces_document_id: z.string().uuid().nullable().optional(),
  void_reason: z.string().trim().min(10, 'Lý do hủy phải có ít nhất 10 ký tự').nullable().optional(),
})

export const contractDocumentReadinessSchema = z.object({
  room_id: z.string().min(1, 'Thiếu phòng'),
  tenant_id: z.string().min(1, 'Thiếu khách thuê'),
  occupant_tenant_ids: z.array(z.string().min(1)).max(10).optional().default([]),
})

export const contractDocumentVoidSchema = z.object({
  reason: z.string().trim().min(10, 'Lý do hủy phải có ít nhất 10 ký tự'),
})

export type ContractDocumentCheckInput = z.infer<typeof contractDocumentCheckSchema>
export type ContractDocumentPreviewInput = z.infer<typeof contractDocumentPreviewSchema>
export type ContractDocumentIssueInput = z.infer<typeof contractDocumentIssueSchema>
export type ContractDocumentReadinessInput = z.infer<typeof contractDocumentReadinessSchema>
export type ContractDocumentVoidInput = z.infer<typeof contractDocumentVoidSchema>
