import { IssueAndPayService } from '../../../../services/billing/issue-and-pay'
import { issueAndPaySchema } from '~/utils/validators/billing-issue-pay'

export default defineEventHandler(async (event) => {
  // Feature-flagged: respond 404 when off so the capability is not discoverable.
  if (!useRuntimeConfig().public.billingAutoIssueEnabled) {
    throw createError({
      statusCode: 404,
      data: { error: { code: 'NOT_FOUND', message: 'Tính năng chưa được bật' } },
    })
  }

  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throwValidationError('Thiếu mã kỳ vận hành')

  const input = await parseBody(event, issueAndPaySchema)

  const invoice = await IssueAndPayService.issueAndPay(event, user, id!, input)
  return { data: invoice }
})
