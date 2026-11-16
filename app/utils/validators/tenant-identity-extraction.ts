import { z } from 'zod'

export const DOCUMENT_TYPES = ['can_cuoc_2024', 'cccd_chip', 'unknown'] as const
export const CAPTURE_LAYOUTS = [
  'separate_images',
  'front_only',
  'back_only',
  'vneid_combined',
  'vneid_details',
  'single_mixed',
  'unknown',
] as const
export const ADDRESS_LABELS = ['noi_cu_tru', 'noi_thuong_tru', 'unknown'] as const
export const EXTRACTION_GENDERS = ['male', 'female', 'other'] as const

const nullableText = z.string().nullable()

export const identityExtractionSchema = z.strictObject({
  document_type: z.enum(DOCUMENT_TYPES),
  capture_layout: z.enum(CAPTURE_LAYOUTS),
  fields: z.strictObject({
    full_name: nullableText,
    id_number: nullableText,
    date_of_birth: nullableText,
    gender: z.enum(EXTRACTION_GENDERS).nullable(),
    nationality: nullableText,
    residence_address: nullableText,
    address_label: z.enum(ADDRESS_LABELS).nullable(),
    birth_registration_place: nullableText,
    place_of_origin: nullableText,
    id_issued_date: nullableText,
    id_expiry_date: nullableText,
    id_issued_place: nullableText,
  }),
  warnings: z.array(z.string()),
  identity_mismatch: z.boolean(),
  needs_review: z.literal(true),
})

export type IdentityExtraction = z.infer<typeof identityExtractionSchema>
export type IdentityExtractionFields = IdentityExtraction['fields']

/** Normalized extraction returned to the client; `apply` carries server-side apply rules. */
export interface IdentitySuggestion extends IdentityExtraction {
  apply: { permanent_address_allowed: boolean }
}

const textOrNull = { type: ['string', 'null'] } as const
const enumOrNull = (values: readonly string[]) => ({ enum: [...values, null] })

const fieldProperties = {
  full_name: textOrNull,
  id_number: textOrNull,
  date_of_birth: textOrNull,
  gender: enumOrNull(EXTRACTION_GENDERS),
  nationality: textOrNull,
  residence_address: textOrNull,
  address_label: enumOrNull(ADDRESS_LABELS),
  birth_registration_place: textOrNull,
  place_of_origin: textOrNull,
  id_issued_date: textOrNull,
  id_expiry_date: textOrNull,
  id_issued_place: textOrNull,
} satisfies Record<keyof IdentityExtractionFields, unknown>

export const IDENTITY_EXTRACTION_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: [
    'document_type',
    'capture_layout',
    'fields',
    'warnings',
    'identity_mismatch',
    'needs_review',
  ],
  properties: {
    document_type: { type: 'string', enum: [...DOCUMENT_TYPES] },
    capture_layout: { type: 'string', enum: [...CAPTURE_LAYOUTS] },
    fields: {
      type: 'object',
      additionalProperties: false,
      required: Object.keys(fieldProperties),
      properties: fieldProperties,
    },
    warnings: { type: 'array', items: { type: 'string' } },
    identity_mismatch: { type: 'boolean' },
    needs_review: { type: 'boolean', enum: [true] },
  },
}
