export interface Tenant {
  id: string
  fullName: string
  phone: string
  email: string | null
  idNumber: string | null
  dateOfBirth: string | null
  permanentAddress: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}
