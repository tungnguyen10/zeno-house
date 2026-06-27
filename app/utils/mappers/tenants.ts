import type { Tables } from '~/types/database.types'
import type { Tenant, TenantStatus } from '~/types/tenants'

export function mapTenant(row: Tables<'tenants'>): Tenant {
  const status: TenantStatus = row.status === 'archived' ? 'archived' : 'active'
  return {
    id: row.id,
    code: row.code,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    idNumber: row.id_number,
    dateOfBirth: row.date_of_birth,
    gender: row.gender,
    occupation: row.occupation,
    idIssuedDate: row.id_issued_date,
    idIssuedPlace: row.id_issued_place,
    emergencyContactName: row.emergency_contact_name,
    emergencyContactPhone: row.emergency_contact_phone,
    permanentAddress: row.permanent_address,
    notes: row.notes,
    status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
