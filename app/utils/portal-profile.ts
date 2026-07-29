import type { TenantGender, TenantProfile } from '~/types/tenant-portal'
import type { TenantProfileUpdateInput } from '~/utils/validators/tenant-portal'
import { tenantProfileUpdateSchema } from '~/utils/validators/tenant-portal'

export interface TenantProfileEditForm {
  full_name: string
  phone: string
  gender: TenantGender | null
  date_of_birth: string
  occupation: string
  permanent_address: string
  id_number: string
  id_issued_date: string
  id_issued_place: string
  emergency_contact_name: string
  emergency_contact_phone: string
  notes: string
}

const PROFILE_EDIT_FIELDS = [
  'full_name',
  'phone',
  'gender',
  'date_of_birth',
  'occupation',
  'permanent_address',
  'id_number',
  'id_issued_date',
  'id_issued_place',
  'emergency_contact_name',
  'emergency_contact_phone',
  'notes',
] as const satisfies ReadonlyArray<keyof TenantProfileUpdateInput>

export function toTenantProfileEditForm(profile: TenantProfile): TenantProfileEditForm {
  return {
    full_name: profile.fullName,
    phone: profile.phone,
    gender: profile.gender,
    date_of_birth: profile.dateOfBirth ?? '',
    occupation: profile.occupation ?? '',
    permanent_address: profile.permanentAddress ?? '',
    id_number: profile.idNumber ?? '',
    id_issued_date: profile.idIssuedDate ?? '',
    id_issued_place: profile.idIssuedPlace ?? '',
    emergency_contact_name: profile.emergencyContactName ?? '',
    emergency_contact_phone: profile.emergencyContactPhone ?? '',
    notes: profile.notes ?? '',
  }
}

function normalizeProfileEditForm(form: TenantProfileEditForm): TenantProfileUpdateInput {
  return {
    full_name: form.full_name.trim(),
    phone: form.phone.trim(),
    gender: form.gender,
    date_of_birth: form.date_of_birth.trim() || null,
    occupation: form.occupation.trim() || null,
    permanent_address: form.permanent_address.trim() || null,
    id_number: form.id_number.trim() || null,
    id_issued_date: form.id_issued_date.trim() || null,
    id_issued_place: form.id_issued_place.trim() || null,
    emergency_contact_name: form.emergency_contact_name.trim() || null,
    emergency_contact_phone: form.emergency_contact_phone.trim() || null,
    notes: form.notes.trim() || null,
  }
}

export function buildTenantProfileChanges(
  current: TenantProfileEditForm,
  baseline: TenantProfileEditForm,
): TenantProfileUpdateInput | null {
  const next = normalizeProfileEditForm(current)
  const previous = normalizeProfileEditForm(baseline)
  const changes: Record<string, unknown> = {}

  for (const field of PROFILE_EDIT_FIELDS) {
    if (next[field] !== previous[field]) {
      changes[field] = next[field]
    }
  }

  return Object.keys(changes).length > 0
    ? changes as TenantProfileUpdateInput
    : null
}

export function validateTenantProfileChanges(changes: TenantProfileUpdateInput | null): {
  data: TenantProfileUpdateInput | null
  fieldErrors: Record<string, string[]>
} {
  if (!changes) {
    return { data: null, fieldErrors: {} }
  }

  const parsed = tenantProfileUpdateSchema.safeParse(changes)
  if (parsed.success) {
    return { data: parsed.data, fieldErrors: {} }
  }

  return {
    data: null,
    fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
  }
}
