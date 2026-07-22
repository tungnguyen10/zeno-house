export const TENANT_ONBOARDING_STAGES = ['password_required'] as const

export type TenantOnboardingStage = (typeof TENANT_ONBOARDING_STAGES)[number]

type UserWithAppMetadata = {
  app_metadata?: unknown
}

export function getTenantOnboardingStage(user: UserWithAppMetadata | null | undefined): TenantOnboardingStage | null {
  const metadata = user?.app_metadata
  if (!metadata || typeof metadata !== 'object') return null
  const { role, tenant_onboarding: stage } = metadata as Record<string, unknown>
  if (role !== 'tenant') return null
  return typeof stage === 'string' && TENANT_ONBOARDING_STAGES.includes(stage as TenantOnboardingStage)
    ? stage as TenantOnboardingStage
    : null
}

export function requiresTenantOnboarding(user: UserWithAppMetadata | null | undefined): boolean {
  return getTenantOnboardingStage(user) !== null
}
