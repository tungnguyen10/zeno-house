import type { ApiSuccess } from '~/types/api'
import type { TenantIdentityImages } from '~/types/tenant-portal'
import type { TenantIdentityImageSide } from '~/utils/validators/tenant-portal'
import { uploadWithProgress } from '~/utils/upload'

/**
 * Identity front/back image slots bound to the archived storage convention.
 * The UI only calls the tenant self-scoped endpoints and renders the returned
 * short-lived signed URLs; it never constructs storage paths or buckets.
 */
export function usePortalIdentityImages() {
  const { data, status, error, refresh } = useFetch<ApiSuccess<TenantIdentityImages>>(
    '/api/tenant/id-images',
    { key: 'portal-id-images', default: () => ({ data: { frontSignedUrl: null, backSignedUrl: null } }) },
  )

  const images = computed<TenantIdentityImages>(
    () => data.value?.data ?? { frontSignedUrl: null, backSignedUrl: null },
  )
  const uploading = ref<Record<TenantIdentityImageSide, boolean>>({ front: false, back: false })
  const progress = ref<Record<TenantIdentityImageSide, number>>({ front: 0, back: 0 })

  async function upload(side: TenantIdentityImageSide, file: File): Promise<ApiSuccess<TenantIdentityImages>> {
    const form = new FormData()
    form.append('image', file)
    uploading.value = { ...uploading.value, [side]: true }
    progress.value = { ...progress.value, [side]: 0 }
    try {
      const res = await uploadWithProgress<ApiSuccess<TenantIdentityImages>>(
        `/api/tenant/id-images/${side}`,
        form,
        { onProgress: pct => (progress.value = { ...progress.value, [side]: pct }) },
      )
      data.value = res
      return res
    }
    finally {
      uploading.value = { ...uploading.value, [side]: false }
    }
  }

  async function remove(side: TenantIdentityImageSide): Promise<void> {
    const res = await apiFetch<ApiSuccess<TenantIdentityImages>>(
      `/api/tenant/id-images/${side}`,
      { method: 'DELETE' },
    )
    data.value = res
  }

  return { images, status, error, refresh, upload, remove, uploading, progress }
}
