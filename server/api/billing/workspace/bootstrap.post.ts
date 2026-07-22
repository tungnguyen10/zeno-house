import { billingPeriodOpenSchema } from '~/utils/validators/billing'
import { BillingWorkspaceBootstrapService } from '../../../services/billing/workspace-bootstrap'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const input = await parseBody(event, billingPeriodOpenSchema)
  return { data: await BillingWorkspaceBootstrapService.get(event, user, input) }
})
