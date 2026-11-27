import type { UserRole } from '~/utils/constants/roles'

export function userInitials(name: string | null, email: string | null): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) return `${words[0]!.charAt(0)}${words.at(-1)!.charAt(0)}`.toLocaleUpperCase('vi')
  if (words.length === 1) return words[0]!.slice(0, 2).toLocaleUpperCase('vi')
  const local = (email ?? '').split('@')[0] ?? ''
  return local.slice(0, 2).toLocaleUpperCase('vi') || '?'
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Quản trị viên',
  owner: 'Chủ nhà',
  manager: 'Quản lý',
  tenant: 'Người thuê',
}

export function managedRoleLabel(role: UserRole | null): string {
  return (role && ROLE_LABELS[role]) || '—'
}
