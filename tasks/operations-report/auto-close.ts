export default defineTask({
  meta: {
    name: 'operations-report:auto-close',
    description: 'Auto-close monthly operations reports on the last day of the month.',
  },
  async run() {
    const config = useRuntimeConfig()
    const siteUrl = config.public.siteUrl
    const secret = config.operationsReportAutoCloseSecret
    if (!siteUrl || !secret) {
      return {
        result: {
          skipped: true,
          reason: 'missing_site_url_or_secret',
        },
      }
    }

    const data = await $fetch(`${siteUrl}/api/internal/operations-report/auto-close`, {
      method: 'POST',
      headers: {
        'x-operations-report-cron-secret': secret,
      },
    })
    return { result: data }
  },
})
