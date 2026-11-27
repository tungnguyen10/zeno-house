import type { ApiSuccess } from '~/types/api'
import type { TenantIdentityImages } from '~/types/tenant-portal'

/**
 * Canonical identity images are verified by management and read-only here.
 * The self-scoped API returns short-lived signed URLs; this client never
 * constructs storage paths or exposes a mutation to replace verified images.
 */
export function usePortalIdentityImages() {
  const { data, status, error, refresh } = useFetch<ApiSuccess<TenantIdentityImages>>(
    '/api/tenant/id-images',
    { key: usePortalSessionKey('id-images'), default: () => ({ data: { frontSignedUrl: null, backSignedUrl: null } }) },
  )

  const images = computed<TenantIdentityImages>(
    () => data.value?.data ?? { frontSignedUrl: null, backSignedUrl: null },
  )
  return { images, status, error, refresh }
}
