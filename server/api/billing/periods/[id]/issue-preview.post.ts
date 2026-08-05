import { BillingInvoiceIssueService } from '../../../../services/billing/invoice-issue-preview'
import { issueInvoicesPreviewSchema } from '~/utils/validators/billing'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throwValidationError('Thiếu mã kỳ vận hành')

  const input = await parseBody(event, issueInvoicesPreviewSchema)
  const result = await BillingInvoiceIssueService.preview(event, user, id, input)
  return { data: result }
})
