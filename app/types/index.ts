export type Role = 'admin' | 'manager' | 'tenant'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: Role
  created_at: string
}
