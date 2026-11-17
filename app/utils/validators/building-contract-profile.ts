import { z } from 'zod'
import { normalizeTenantPhone, TENANT_PHONE_INVALID_MESSAGE } from '~/utils/tenant-identity'

const blankToNull = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? null : value)

// Form inputs emit numeric text; coerce it so number schemas accept it on client and server.
const numericText = (value: unknown) => {
  const next = blankToNull(value)
  return typeof next === 'string' && !Number.isNaN(Number(next)) ? Number(next) : next
}

const optionalText = (min: number, max: number, label: string) =>
  z.preprocess(blankToNull, z.string().trim().min(min, `${label} quá ngắn`).max(max, `${label} quá dài`).nullable().default(null))

const optionalDate = z.preprocess(
  blankToNull,
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ').nullable().default(null),
)

const optionalInt = (min: number, max: number) =>
  z.preprocess(numericText, z.number().int('Phải là số nguyên').min(min, `Tối thiểu ${min}`).max(max, `Tối đa ${max}`).nullable().default(null))

const optionalMoney = z.preprocess(numericText, z.number().int('Phải là số nguyên').min(0, 'Không được âm').nullable().default(null))

const optionalEmail = z.preprocess(
  value => (typeof value === 'string' ? value.trim().toLowerCase() : value),
  z.preprocess(blankToNull, z.string().max(254, 'Email quá dài').email('Email không hợp lệ').nullable().default(null)),
)

export const CONTRACT_PROFILE_PII_FIELDS = ['lessor_date_of_birth', 'lessor_permanent_address', 'lessor_id_number'] as const

export const buildingContractProfileBaseSchema = z.object({
  lessor_full_name: optionalText(2, 100, 'Họ tên'),
  lessor_date_of_birth: optionalDate,
  lessor_permanent_address: optionalText(1, 255, 'Địa chỉ'),
  lessor_id_number: z.preprocess(
    value => (typeof value === 'string' ? value.replace(/\s/g, '') : value),
    z.preprocess(blankToNull, z.string().regex(/^\d{9}(\d{3})?$/, 'Số CMND/CCCD phải gồm 9 hoặc 12 chữ số').nullable().default(null)),
  ),
  lessor_id_issued_date: optionalDate.refine(
    value => value === null || value <= new Date().toISOString().slice(0, 10),
    'Ngày cấp không được ở tương lai',
  ),
  lessor_id_issued_place: optionalText(1, 150, 'Nơi cấp'),
  lessor_phone: z.preprocess(blankToNull, z.string().max(20, 'Số điện thoại quá dài').nullable().default(null))
    .transform((value, ctx) => {
      if (value === null) return null
      const normalized = normalizeTenantPhone(value)
      if (!normalized) {
        ctx.addIssue({ code: 'custom', message: TENANT_PHONE_INVALID_MESSAGE })
        return z.NEVER
      }
      return normalized
    }),
  brand_name: optionalText(1, 100, 'Tên thương hiệu'),
  lessor_email: optionalEmail,
  default_term_months: optionalInt(1, 60),
  default_deposit_months: z.preprocess(
    numericText,
    z.number().min(0, 'Tối thiểu 0').max(6, 'Tối đa 6')
      .refine(value => Math.abs(value * 10 - Math.round(value * 10)) < 1e-9, 'Tối đa 1 chữ số thập phân')
      .nullable().default(null),
  ),
  notice_days: optionalInt(0, 180),
  deposit_refund_days: optionalInt(0, 90),
  renewal_months: optionalInt(0, 24),
  extra_occupant_fee: optionalMoney,
  drilling_fee: optionalMoney,
  fingerprint_reset_fee: optionalMoney,
  signed_copies: z.preprocess(numericText, z.number().int().min(1, 'Tối thiểu 1').max(10, 'Tối đa 10').default(2)),
  copies_per_party: z.preprocess(numericText, z.number().int().min(1, 'Tối thiểu 1').max(5, 'Tối đa 5').default(1)),
}).strict()

export function contractProfileCopiesRule(value: { signed_copies?: number; copies_per_party?: number }, ctx: z.RefinementCtx) {
  if (value.signed_copies == null || value.copies_per_party == null) return
  if (value.copies_per_party * 2 > value.signed_copies) {
    ctx.addIssue({ code: 'custom', path: ['copies_per_party'], message: 'Tổng số bản hai bên giữ vượt quá số bản ký' })
  }
}

export const buildingContractProfileSchema = buildingContractProfileBaseSchema.superRefine(contractProfileCopiesRule)

export type BuildingContractProfileInput = z.infer<typeof buildingContractProfileSchema>
export type BuildingContractProfilePatch = Partial<BuildingContractProfileInput>

const patchSchema = buildingContractProfileBaseSchema.partial()

// Zod 4 `.partial()` still applies `.default()` to absent keys, so keep only keys the client sent.
export function parseContractProfilePatch(body: unknown) {
  const result = patchSchema.safeParse(body)
  if (!result.success) return result
  const sent = new Set(Object.keys(body as object))
  const data = Object.fromEntries(Object.entries(result.data).filter(([key]) => sent.has(key))) as BuildingContractProfilePatch
  return { success: true as const, data }
}
