import { describe, expect, it } from 'vitest'
import {
  IDENTITY_EXTRACTION_JSON_SCHEMA,
  identityExtractionSchema,
} from '~/utils/validators/tenant-identity-extraction'

const validExtraction = () => ({
  document_type: 'can_cuoc_2024',
  capture_layout: 'separate_images',
  fields: {
    full_name: 'NGUYEN VAN MAU',
    id_number: '001099000000',
    date_of_birth: '1999-01-31',
    gender: 'male',
    nationality: 'Việt Nam',
    residence_address: 'Phường Mẫu, Quận Thử, Hà Nội',
    address_label: 'noi_thuong_tru',
    birth_registration_place: null,
    place_of_origin: null,
    id_issued_date: '2024-05-01',
    id_expiry_date: null,
    id_issued_place: null,
  },
  warnings: [],
  identity_mismatch: false,
  needs_review: true,
})

describe('identityExtractionSchema', () => {
  it('parses a valid fictional extraction', () => {
    expect(identityExtractionSchema.safeParse(validExtraction()).success).toBe(true)
  })

  it('rejects unknown keys at the root', () => {
    const result = identityExtractionSchema.safeParse({ ...validExtraction(), extra: 1 })
    expect(result.success).toBe(false)
  })

  it('rejects unknown keys inside fields', () => {
    const input = validExtraction()
    const result = identityExtractionSchema.safeParse({
      ...input,
      fields: { ...input.fields, phone: '0900000000' },
    })
    expect(result.success).toBe(false)
  })

  it('rejects needs_review other than true', () => {
    const result = identityExtractionSchema.safeParse({ ...validExtraction(), needs_review: false })
    expect(result.success).toBe(false)
  })

  it('rejects unknown enum values', () => {
    const result = identityExtractionSchema.safeParse({ ...validExtraction(), document_type: 'passport' })
    expect(result.success).toBe(false)
  })

  it('requires every field key to be present', () => {
    const input = validExtraction()
    const { full_name: _omitted, ...rest } = input.fields
    expect(identityExtractionSchema.safeParse({ ...input, fields: rest }).success).toBe(false)
  })
})

describe('IDENTITY_EXTRACTION_JSON_SCHEMA', () => {
  const schema = IDENTITY_EXTRACTION_JSON_SCHEMA as {
    additionalProperties: boolean
    required: string[]
    properties: Record<string, { additionalProperties?: boolean; required?: string[]; properties?: Record<string, { type?: unknown, enum?: unknown[] }> }>
  }

  it('forbids additional properties at root and fields', () => {
    expect(schema.additionalProperties).toBe(false)
    expect(schema.properties.fields?.additionalProperties).toBe(false)
  })

  it('requires every root key', () => {
    expect(schema.required.sort()).toEqual(Object.keys(schema.properties).sort())
  })

  it('requires every field key and allows null', () => {
    const fields = schema.properties.fields
    const keys = Object.keys(fields?.properties ?? {})
    expect(keys.length).toBe(12)
    expect([...(fields?.required ?? [])].sort()).toEqual([...keys].sort())
    for (const key of keys) {
      const prop = fields?.properties?.[key]
      const nullable = Array.isArray(prop?.type) ? prop.type.includes('null') : prop?.enum?.includes(null)
      expect(nullable, key).toBe(true)
    }
  })
})
