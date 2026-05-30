export interface Tenant {
  id: string
  fullName: string
  phone: string
  email: string | null
  idNumber: string | null
  dateOfBirth: string | null
  gender: string | null
  occupation: string | null
  idIssuedDate: string | null
  idIssuedPlace: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  permanentAddress: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}
