export function getRedirectByRole(role: string | null | undefined): string {
  if (role === 'tenant') return '/portal'
  if (role === 'admin' || role === 'owner' || role === 'manager') return '/dashboard'
  if (role === null || role === undefined || role === '') return '/auth/pending'
  return '/login'
}
