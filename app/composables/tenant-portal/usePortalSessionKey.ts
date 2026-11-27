import { portalSessionDataKey, portalSessionIdentity } from '~/utils/tenant-portal/session'

/** A different account must never reuse the previous tenant's async-data entry. */
export function usePortalSessionKey(resource: MaybeRefOrGetter<string>) {
  const user = useSupabaseUser()
  return computed(() => portalSessionDataKey(portalSessionIdentity(user.value), toValue(resource)))
}
