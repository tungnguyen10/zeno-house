import { TenantOnboardingService } from '../../../../services/tenant-portal/onboarding'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  await TenantOnboardingService.confirmGoogleLink(event, user)
  return { data: { stage: null } }
})
