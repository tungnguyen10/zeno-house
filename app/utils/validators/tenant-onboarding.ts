import { z } from 'zod'

export const tenantOnboardingPasswordSchema = z.object({
  password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự').max(72, 'Mật khẩu tối đa 72 ký tự'),
})

export const tenantOnboardingEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email không hợp lệ'),
})

export type TenantOnboardingPasswordInput = z.infer<typeof tenantOnboardingPasswordSchema>
export type TenantOnboardingEmailInput = z.infer<typeof tenantOnboardingEmailSchema>
