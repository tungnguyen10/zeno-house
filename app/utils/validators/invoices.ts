import { z } from 'zod'
import type { InvoiceStatus } from '~/utils/constants/billing'
import { INVOICE_STATUSES } from '~/utils/constants/billing'

const INVOICE_LIST_STATUSES = INVOICE_STATUSES.filter(status => status !== 'draft')

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (value === undefined || value === null || value === '') return []
  return [value]
}

export const invoiceListQuerySchema = z.object({
  building_id: z.string().min(1).optional(),
  period_year: z.coerce.number().int().min(2000).max(2100).optional(),
  period_month: z.coerce.number().int().min(1).max(12).optional(),
  status: z.preprocess(
    asArray,
    z.array(z.enum(INVOICE_LIST_STATUSES as [InvoiceStatus, ...InvoiceStatus[]])),
  ).default([]),
  tenant_search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(50),
})

export type InvoiceListQuery = z.infer<typeof invoiceListQuerySchema>

export interface InvoiceListItem {
  id: string
  invoice_code: string
  billing_period_id: string
  period_year: number
  period_month: number
  building_id: string
  building_name: string | null
  building_slug?: string | null
  room_id: string
  room_number: string | null
  contract_id: string
  contract_code: string | null
  tenant_id: string
  tenant_name: string | null
  tenant_phone?: string | null
  total_amount: number
  paid_amount: number
  balance_amount: number
  due_date: string | null
  status: InvoiceStatus
  issued_at: string | null
  voided_at?: string | null
  void_reason?: string | null
  notes?: string | null
}

export interface InvoiceListMeta {
  page: number
  page_size: number
  total: number
  total_pages: number
}

export interface InvoiceListResponse {
  data: InvoiceListItem[]
  meta: InvoiceListMeta
}
