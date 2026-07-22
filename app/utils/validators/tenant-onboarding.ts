import { z } from 'zod'

export const tenantOnboardingPasswordSchema = z.object({
  password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự').max(72, 'Mật khẩu tối đa 72 ký tự'),
})

export type TenantOnboardingPasswordInput = z.infer<typeof tenantOnboardingPasswordSchema>
