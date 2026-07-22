import { describe, expect, it } from 'vitest'
import {
  getTenantOnboardingStage,
  requiresTenantOnboarding,
} from '~/utils/tenant-onboarding'

describe('tenant onboarding state', () => {
  it('recognizes password_required only for tenant accounts', () => {
    const user = { app_metadata: { role: 'tenant', tenant_onboarding: 'password_required' } }

    expect(getTenantOnboardingStage(user)).toBe('password_required')
    expect(requiresTenantOnboarding(user)).toBe(true)
  })

  it.each(['email_required', 'google_required'])(
    'ignores the legacy %s metadata without requiring a data migration',
    (stage) => {
      const user = { app_metadata: { role: 'tenant', tenant_onboarding: stage } }

      expect(getTenantOnboardingStage(user)).toBeNull()
      expect(requiresTenantOnboarding(user)).toBe(false)
    },
  )

  it('ignores unknown or non-tenant onboarding metadata', () => {
    expect(getTenantOnboardingStage({ app_metadata: { role: 'tenant', tenant_onboarding: 'done' } })).toBeNull()
    expect(getTenantOnboardingStage({ app_metadata: { role: 'manager', tenant_onboarding: 'password_required' } })).toBeNull()
    expect(requiresTenantOnboarding({ app_metadata: { role: 'tenant' } })).toBe(false)
  })
})
