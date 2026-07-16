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

export function getLegacyDashboardRedirect(path: string): string | null {
  const [pathname] = path.split(/[?#]/, 1)
  const isLegacyPath = LEGACY_DASHBOARD_PREFIXES.some(prefix => (
    pathname === prefix || pathname?.startsWith(`${prefix}/`)
  ))

  return isLegacyPath ? `/dashboard${path}` : null
}
