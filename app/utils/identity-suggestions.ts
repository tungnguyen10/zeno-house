import type { IdentitySuggestion } from '~/utils/validators/identity-extraction'

export type SuggestionField =
  | 'full_name'
  | 'id_number'
  | 'date_of_birth'
  | 'gender'
  | 'id_issued_date'
  | 'id_issued_place'
  | 'permanent_address'

export type SuggestionState = 'applicable' | 'matches' | 'edited' | 'blocked' | 'review'

export interface SuggestionRow {
  field: SuggestionField
  label: string
  /** Value to write into the form. */
  value: string
  display: string
  current: string
  state: SuggestionState
  note?: string
}

export type SuggestionValues = Partial<Record<SuggestionField, string>>

const LABELS: Record<SuggestionField, string> = {
  full_name: 'Họ và tên',
  id_number: 'Số CMND/CCCD',
  date_of_birth: 'Ngày sinh',
  gender: 'Giới tính',
  id_issued_date: 'Ngày cấp',
  id_issued_place: 'Nơi cấp',
  permanent_address: 'Địa chỉ thường trú',
}

const GENDER_LABELS: Record<string, string> = { male: 'Nam', female: 'Nữ', other: 'Khác' }

export const SUGGESTION_FIELD_ORDER: SuggestionField[] = [
  'full_name', 'id_number', 'date_of_birth', 'gender', 'id_issued_date', 'id_issued_place', 'permanent_address',
]

const RESIDENCE_NOTE = 'Nơi cư trú có thể khác nơi thường trú. Kiểm tra trước khi dùng.'

function toDisplay(field: SuggestionField, value: string): string {
  if (field === 'gender') return GENDER_LABELS[value] ?? value
  if (field === 'date_of_birth' || field === 'id_issued_date') {
    const [year, month, day] = value.split('-')
    return year && month && day ? `${day}/${month}/${year}` : value
  }
  return value
}

function suggestedValue(field: SuggestionField, suggestion: IdentitySuggestion): string | null {
  const { fields } = suggestion
  if (field === 'permanent_address') return fields.residence_address
  return fields[field]
}

/**
 * Builds the review rows. `current` is the live form value; `lastApplied` is what the
 * scanner wrote earlier, so a value it wrote is not mistaken for manual input.
 */
export function buildSuggestionRows(
  suggestion: IdentitySuggestion,
  current: SuggestionValues,
  lastApplied: SuggestionValues,
  targets: SuggestionField[],
): SuggestionRow[] {
  const rows: SuggestionRow[] = []
  for (const field of SUGGESTION_FIELD_ORDER) {
    if (!targets.includes(field)) continue
    const value = suggestedValue(field, suggestion)
    if (value === null) continue

    const currentValue = (current[field] ?? '').trim()
    let state: SuggestionState
    let note: string | undefined
    if (suggestion.identity_mismatch) {
      state = 'blocked'
    }
    else if (field === 'permanent_address' && !suggestion.apply.permanent_address_allowed) {
      state = 'review'
      note = RESIDENCE_NOTE
    }
    else if (currentValue === value) {
      state = 'matches'
    }
    else if (currentValue !== '' && currentValue !== (lastApplied[field] ?? '')) {
      state = 'edited'
    }
    else {
      state = 'applicable'
    }
    rows.push({ field, label: LABELS[field], value, display: toDisplay(field, value), current: currentValue, state, note })
  }
  return rows
}
