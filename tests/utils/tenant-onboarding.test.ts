import { describe, expect, it } from 'vitest'
import {
  getTenantOnboardingStage,
  requiresTenantOnboarding,
} from '~/utils/tenant-onboarding'

describe('tenant onboarding state', () => {
  it.each(['password_required', 'email_required', 'google_required'] as const)(
    'recognizes the %s stage only for tenant accounts',
    (stage) => {
      const user = { app_metadata: { role: 'tenant', tenant_onboarding: stage } }

      expect(getTenantOnboardingStage(user)).toBe(stage)
      expect(requiresTenantOnboarding(user)).toBe(true)
    },
  )

  it('ignores unknown or non-tenant onboarding metadata', () => {
    expect(getTenantOnboardingStage({ app_metadata: { role: 'tenant', tenant_onboarding: 'done' } })).toBeNull()
    expect(getTenantOnboardingStage({ app_metadata: { role: 'manager', tenant_onboarding: 'password_required' } })).toBeNull()
    expect(requiresTenantOnboarding({ app_metadata: { role: 'tenant' } })).toBe(false)
  })
})
