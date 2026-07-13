import { z } from 'zod'
import { BILLING_AUDIT_CATEGORIES } from '~/utils/constants/billing'

/**
 * Query schema for `GET /api/billing/periods/:id/audit`. Supports server-side
 * filtering, full-text search, and cursor pagination for the rework drawer.
 *
 * `actor` and `category` accept comma-separated values. New cursors combine
 * the last row's ISO timestamp and UUID; timestamp-only cursors remain valid
 * for backward compatibility.
 */
export const billingAuditListQuerySchema = z.object({
  actor: z
    .string()
    .optional()
    .transform(v => (v ? v.split(',').map(s => s.trim()).filter(Boolean) : undefined))
    .pipe(z.array(z.string().uuid()).max(50).optional()),
  category: z
    .string()
    .optional()
    .transform(v => (v ? v.split(',').map(s => s.trim()).filter(Boolean) : undefined))
    .pipe(z.array(z.enum(BILLING_AUDIT_CATEGORIES)).max(BILLING_AUDIT_CATEGORIES.length).optional()),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  q: z.string().trim().min(1).max(200).optional(),
  correlation_id: z.string().uuid().optional(),
  cursor: z.string().max(100).refine((value) => {
    const [createdAt, id, ...rest] = value.split('|')
    if (rest.length > 0 || !z.string().datetime({ offset: true }).safeParse(createdAt).success) return false
    return id === undefined || z.string().uuid().safeParse(id).success
  }, 'Cursor không hợp lệ').optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export type BillingAuditListQuery = z.infer<typeof billingAuditListQuerySchema>
