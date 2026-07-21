import { tenantOnboardingPasswordSchema } from '~/utils/validators/tenant-onboarding'
import { TenantOnboardingService } from '../../../services/tenant-portal/onboarding'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const input = await parseBody(event, tenantOnboardingPasswordSchema, 'Mật khẩu mới không hợp lệ')
  await TenantOnboardingService.setPassword(event, user, input)
  return { data: { stage: 'email_required' } }
})
