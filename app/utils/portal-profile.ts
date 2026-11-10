import type { TenantProfile } from '~/types/tenant-portal'
import type { TenantProfileUpdateInput } from '~/utils/validators/tenant-portal'
import { tenantProfileUpdateSchema } from '~/utils/validators/tenant-portal'

export interface TenantProfileEditForm {
  phone: string
  occupation: string
  emergency_contact_name: string
  emergency_contact_phone: string
}

const PROFILE_EDIT_FIELDS = [
  'phone',
  'occupation',
  'emergency_contact_name',
  'emergency_contact_phone',
] as const satisfies ReadonlyArray<keyof TenantProfileUpdateInput>

export function toTenantProfileEditForm(profile: TenantProfile): TenantProfileEditForm {
  return {
    phone: profile.phone,
    occupation: profile.occupation ?? '',
    emergency_contact_name: profile.emergencyContactName ?? '',
    emergency_contact_phone: profile.emergencyContactPhone ?? '',
  }
}

function normalizeProfileEditForm(form: TenantProfileEditForm): TenantProfileUpdateInput {
  return {
    phone: form.phone.trim(),
    occupation: form.occupation.trim() || null,
    emergency_contact_name: form.emergency_contact_name.trim() || null,
    emergency_contact_phone: form.emergency_contact_phone.trim() || null,
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
