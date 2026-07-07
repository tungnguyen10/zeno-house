function isEnabled(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return !(normalized === '' || normalized === '0' || normalized === 'false' || normalized === 'off' || normalized === 'no')
  }

  return Boolean(value)
}

export default defineTask({
  meta: {
    name: 'operations-report:auto-close',
    description: 'Auto-close monthly operations reports on the last day of the month.',
  },
  async run() {
    const config = useRuntimeConfig()
    const enabled = isEnabled(config.operationsReportAutoCloseEnabled)
    const siteUrl = config.public.siteUrl
    const secret = config.operationsReportAutoCloseSecret

    if (!enabled) {
      return {
        result: {
          skipped: true,
          reason: 'disabled_by_config',
        },
      }
    }

    if (!siteUrl || !secret) {
      return {
        result: {
          skipped: true,
          reason: 'missing_site_url_or_secret',
        },
      }
    }

    await $fetch(`${siteUrl}/api/internal/operations-report/auto-close`, {
      method: 'POST',
      headers: {
        'x-operations-report-cron-secret': secret,
      },
    })
    return {
      result: {
        skipped: false,
        reason: 'executed',
      },
    }
  },
})
