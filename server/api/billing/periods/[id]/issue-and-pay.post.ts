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

  const body = await readBody(event)
  const parsed = issueAndPaySchema.safeParse(body)
  if (!parsed.success) {
    throwValidationError('Dữ liệu không hợp lệ', parsed.error.flatten())
  }

  const invoice = await IssueAndPayService.issueAndPay(event, user, id!, parsed.data)
  return { data: invoice }
})
