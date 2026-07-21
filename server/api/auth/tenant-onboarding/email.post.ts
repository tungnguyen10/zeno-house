import { tenantOnboardingEmailSchema } from '~/utils/validators/tenant-onboarding'
import { TenantOnboardingService } from '../../../services/tenant-portal/onboarding'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const input = await parseBody(event, tenantOnboardingEmailSchema, 'Email không hợp lệ')
  await TenantOnboardingService.requestEmailChange(event, user, input)
  return { data: { email: input.email } }
})
