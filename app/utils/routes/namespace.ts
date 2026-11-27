const LEGACY_DASHBOARD_PREFIXES = [
  '/billing',
  '/buildings',
  '/contracts',
  '/invoices',
  '/operations-report',
  '/rooms',
  '/settings',
  '/shared-expenses',
  '/tenants',
  '/ui-showcase',
]

const MOVED_DASHBOARD_ROUTES: Record<string, string> = {
  '/dashboard/profile': '/dashboard/settings/profile',
  '/dashboard/profile/password': '/dashboard/settings/security',
}

export function getLegacyDashboardRedirect(path: string): string | null {
  const [pathname = ''] = path.split(/[?#]/, 1)
  const moved = MOVED_DASHBOARD_ROUTES[pathname.replace(/\/$/, '')]
  if (moved) return `${moved}${path.slice(pathname.length)}`

  const isLegacyPath = LEGACY_DASHBOARD_PREFIXES.some(prefix => (
    pathname === prefix || pathname?.startsWith(`${prefix}/`)
  ))

  return isLegacyPath ? `/dashboard${path}` : null
}
