import { TenantOnboardingService } from '../../../../services/tenant-portal/onboarding'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  await TenantOnboardingService.confirmEmail(event, user)
  return { data: { stage: 'google_required' } }
})
