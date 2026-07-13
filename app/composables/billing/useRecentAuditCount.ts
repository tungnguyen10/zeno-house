import type { ApiSuccess } from '~/types/api'
import type { BillingAuditEvent } from '~/types/billing'

/**
 * Lazily fetches the number of audit events for a period in the last 24h.
 * Called `load()` explicitly (e.g. on workspace mount) to avoid unnecessary
 * requests when the drawer is never opened.
 */
export function useRecentAuditCount(periodId: MaybeRefOrGetter<string>) {
  const id = computed(() => toValue(periodId))
  const count = ref(0)
  const loaded = ref(false)

  async function load() {
    if (!id.value || loaded.value) return
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    try {
      const resp = await apiFetch<ApiSuccess<BillingAuditEvent[]>>(
        `/api/billing/periods/${id.value}/audit`,
        { params: { from: since, limit: '100' } },
      )
      count.value = resp.data.length
      loaded.value = true
    }
    catch {
      // Non-critical — badge simply stays 0
    }
  }

  return { count, loaded, load }
}
