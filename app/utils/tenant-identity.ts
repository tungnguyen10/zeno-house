import { z } from 'zod'

const PHONE_SEPARATORS = /[\s.()-]/g

export const TENANT_PHONE_INVALID_MESSAGE = 'Số điện thoại không hợp lệ'

export function normalizeTenantPhone(input: string): string | null {
  const compact = input.replace(PHONE_SEPARATORS, '')
  if (/^0\d{9}$/.test(compact)) return compact
  const vietnam = compact.match(/^\+?84(\d{9})$/)
  if (vietnam) return `0${vietnam[1]}`
  if (compact.startsWith('+84')) return null
  if (/^\+[1-9]\d{7,14}$/.test(compact)) return compact
  return null
}

export function normalizeTenantIdNumber(input: string | null | undefined): string | null {
  if (input == null) return null
  const compact = input.replace(/\s/g, '').toUpperCase()
  return compact === '' ? null : compact
}

export const tenantPhoneSchema = z.string()
  .min(1, 'Số điện thoại không được trống')
  .max(20, 'Số điện thoại quá dài')
  .transform((value, ctx) => {
    const normalized = normalizeTenantPhone(value)
    if (!normalized) {
      ctx.addIssue({ code: 'custom', message: TENANT_PHONE_INVALID_MESSAGE })
      return z.NEVER
    }
    return normalized
  })

export const tenantIdNumberSchema = z.string()
  .max(20, 'Số CMND/CCCD quá dài')
  .nullable()
  .optional()
  .transform(value => (value === undefined ? undefined : normalizeTenantIdNumber(value)))

export const TENANT_SENSITIVE_DRAFT_KEYS = [
  'id_number', 'id_issued_date', 'id_issued_place', 'date_of_birth',
  'permanent_address', 'emergency_contact_name', 'emergency_contact_phone',
] as const
