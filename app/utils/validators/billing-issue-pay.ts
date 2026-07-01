import { z } from 'zod'

/**
 * Input for the one-click auto-issue ("Đã thu") flow: issue a single ready
 * draft and record a full-balance payment in one transaction.
 *
 * The period id comes from the route param; `contract_id` selects the draft to
 * issue. No `amount` field — the payment always covers the full draft total
 * (partial payments are not supported in the simplified workflow).
 */
export const issueAndPaySchema = z.object({
  contract_id: z.string().uuid(),
  payment_date: z.string().min(1, 'Cần ngày thanh toán'),
  payment_method: z.string().max(100).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  due_date: z.string().nullable().optional(),
})
export type IssueAndPayInput = z.infer<typeof issueAndPaySchema>
