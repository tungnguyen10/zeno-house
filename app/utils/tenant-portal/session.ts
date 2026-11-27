/** Handles both the Auth User shape and the JWT claims returned by the Nuxt module. */
export function portalSessionIdentity(user: { sub?: unknown; id?: unknown } | null | undefined): string | null {
  if (typeof user?.sub === 'string' && user.sub) return user.sub
  if (typeof user?.id === 'string' && user.id) return user.id
  return null
}

export function portalSessionDataKey(identity: string | null, resource: string): string {
  return `portal-${identity ?? 'anonymous'}-${resource}`
}

export function isPortalDataKey(key: string): boolean {
  return key.startsWith('portal-')
}
