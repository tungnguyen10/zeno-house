import type {
  IdentityExtraction,
  IdentityExtractionFields,
} from '~/utils/validators/tenant-identity-extraction'

export interface IdentitySuggestion extends IdentityExtraction {
  apply: { permanent_address_allowed: boolean }
}

const ID_NUMBER_PATTERN = /^\d{9}(\d{3})?$/
const DATE_PATTERN = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$|^(\d{4})-(\d{2})-(\d{2})$/

function cleanText(value: string | null): string | null {
  if (value === null) return null
  const cleaned = value.normalize('NFC').replace(/\s+/g, ' ').trim()
  return cleaned === '' ? null : cleaned
}

function toIsoDate(value: string): string | null {
  const match = DATE_PATTERN.exec(value)
  if (!match) return null
  const [day, month, year] = match[1]
    ? [Number(match[1]), Number(match[2]), Number(match[3])]
    : [Number(match[6]), Number(match[5]), Number(match[4])]
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return date.toISOString().slice(0, 10)
}

const DATE_FIELDS = [
  ['date_of_birth', 'Ngày sinh'],
  ['id_issued_date', 'Ngày cấp'],
  ['id_expiry_date', 'Ngày hết hạn'],
] as const

/** Model output is untrusted: normalize, drop unreliable values and never invent data. */
export function normalizeExtraction(raw: IdentityExtraction): IdentitySuggestion {
  const warnings: string[] = []
  const fields = { ...raw.fields } as IdentityExtractionFields

  for (const key of Object.keys(fields) as (keyof IdentityExtractionFields)[]) {
    const value = fields[key]
    if (typeof value === 'string' && key !== 'gender' && key !== 'address_label') {
      ;(fields as Record<string, string | null>)[key] = cleanText(value)
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  for (const [key, label] of DATE_FIELDS) {
    const value = fields[key]
    if (value === null) continue
    const iso = toIsoDate(value)
    if (iso === null || (key === 'date_of_birth' && iso > today)) {
      fields[key] = null
      warnings.push(`${label} không hợp lệ`)
    }
    else {
      fields[key] = iso
    }
  }

  if (fields.id_number !== null) {
    const digits = fields.id_number.replace(/\s+/g, '')
    if (ID_NUMBER_PATTERN.test(digits)) {
      fields.id_number = digits
    }
    else {
      fields.id_number = null
      warnings.push('Số định danh không đọc chắc chắn')
    }
  }

  if (raw.identity_mismatch) warnings.push('Hai ảnh có thông tin không khớp')

  const modelWarnings = raw.warnings.map(cleanText).filter((warning): warning is string => warning !== null)

  return {
    ...raw,
    fields,
    warnings: [...new Set([...modelWarnings, ...warnings])],
    apply: { permanent_address_allowed: fields.address_label === 'noi_thuong_tru' && !raw.identity_mismatch },
  }
}
