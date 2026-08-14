import { z } from 'zod'
import { passwordSchema } from './password'

export const tenantOnboardingPasswordSchema = z.object({
  password: passwordSchema,
})

export type TenantOnboardingPasswordInput = z.infer<typeof tenantOnboardingPasswordSchema>
