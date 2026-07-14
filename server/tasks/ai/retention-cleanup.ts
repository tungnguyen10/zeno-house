export default defineTask({
  meta: {
    name: 'ai:retention-cleanup',
    description: 'Delete expired AI conversations and stale rate-limit buckets in bounded batches.',
  },
  async run() {
    const config = useRuntimeConfig()
    const siteUrl = config.public.siteUrl
    const secret = config.aiRetentionCleanupSecret
    if (!config.aiRetentionCleanupEnabled) {
      return { result: { skipped: true, reason: 'disabled_by_config' } }
    }
    if (!siteUrl || !secret) {
      return { result: { skipped: true, reason: 'missing_site_url_or_secret' } }
    }
    const response = await $fetch<{ data: Record<string, unknown> }>(
      `${siteUrl}/api/internal/ai/retention-cleanup`,
      { method: 'POST', headers: { 'x-ai-retention-secret': String(secret) } },
    )
    return { result: response.data }
  },
})
