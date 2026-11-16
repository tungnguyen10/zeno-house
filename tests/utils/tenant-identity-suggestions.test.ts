import { describe, expect, it } from 'vitest'
import type { IdentitySuggestion } from '~/utils/validators/tenant-identity-extraction'
import { buildSuggestionRows, type SuggestionField } from '~/utils/tenant-identity-suggestions'

const ALL: SuggestionField[] = ['full_name', 'id_number', 'date_of_birth', 'gender', 'id_issued_date', 'id_issued_place', 'permanent_address']

function suggestion(fields: Partial<IdentitySuggestion['fields']> = {}, overrides: Partial<IdentitySuggestion> = {}): IdentitySuggestion {
  return {
    document_type: 'can_cuoc_2024',
    capture_layout: 'separate_images',
    fields: {
      full_name: 'NGUYỄN VĂN MẪU',
      id_number: '001099000000',
      date_of_birth: '1999-01-31',
      gender: 'male',
      nationality: 'Việt Nam',
      residence_address: 'Phường Mẫu, Hà Nội',
      address_label: 'noi_thuong_tru',
      birth_registration_place: null,
      place_of_origin: null,
      id_issued_date: '2024-05-01',
      id_expiry_date: null,
      id_issued_place: null,
      ...fields,
    },
    warnings: [],
    identity_mismatch: false,
    needs_review: true,
    apply: { permanent_address_allowed: true },
    ...overrides,
  }
}

const rowOf = (rows: ReturnType<typeof buildSuggestionRows>, field: SuggestionField) => rows.find(row => row.field === field)

describe('buildSuggestionRows', () => {
  it('lists only fields with a suggestion that the form can accept', () => {
    const rows = buildSuggestionRows(suggestion(), {}, {}, ['full_name', 'id_number'])
    expect(rows.map(row => row.field)).toEqual(['full_name', 'id_number'])
    expect(buildSuggestionRows(suggestion({ full_name: null }), {}, {}, ALL).map(row => row.field)).not.toContain('full_name')
  })

  it('formats dates and gender for display but keeps raw values to apply', () => {
    const rows = buildSuggestionRows(suggestion(), {}, {}, ALL)
    expect(rowOf(rows, 'date_of_birth')).toMatchObject({ value: '1999-01-31', display: '31/01/1999' })
    expect(rowOf(rows, 'gender')).toMatchObject({ value: 'male', display: 'Nam' })
  })

  it('marks empty current fields as applicable', () => {
    expect(rowOf(buildSuggestionRows(suggestion(), { full_name: '  ' }, {}, ALL), 'full_name')?.state).toBe('applicable')
  })

  it('marks a field the user typed as edited', () => {
    expect(rowOf(buildSuggestionRows(suggestion(), { full_name: 'Tên tôi gõ' }, {}, ALL), 'full_name')?.state).toBe('edited')
  })

  it('treats a value the scanner applied earlier as still applicable', () => {
    const rows = buildSuggestionRows(suggestion(), { full_name: 'GIÁ TRỊ CŨ' }, { full_name: 'GIÁ TRỊ CŨ' }, ALL)
    expect(rowOf(rows, 'full_name')?.state).toBe('applicable')
  })

  it('marks identical values as matched', () => {
    expect(rowOf(buildSuggestionRows(suggestion(), { id_number: '001099000000' }, {}, ALL), 'id_number')?.state).toBe('matches')
  })

  it('only suggests the permanent address when the label allows it', () => {
    const allowed = buildSuggestionRows(suggestion(), {}, {}, ALL)
    expect(rowOf(allowed, 'permanent_address')).toMatchObject({ state: 'applicable', value: 'Phường Mẫu, Hà Nội' })

    const residence = buildSuggestionRows(
      suggestion({ address_label: 'noi_cu_tru' }, { apply: { permanent_address_allowed: false } }),
      {}, {}, ALL,
    )
    expect(rowOf(residence, 'permanent_address')).toMatchObject({ state: 'review' })
    expect(rowOf(residence, 'permanent_address')?.note).toContain('Nơi cư trú')
  })

  it('blocks every row when the images do not match', () => {
    const rows = buildSuggestionRows(suggestion({}, { identity_mismatch: true, apply: { permanent_address_allowed: false } }), {}, {}, ALL)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every(row => row.state === 'blocked')).toBe(true)
  })
})
