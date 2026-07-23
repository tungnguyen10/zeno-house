export default defineTask({
  meta: {
    name: 'invoice-email:dispatch',
    description: 'Dispatch due invoice emails from the durable outbox.',
  },
  async run() {
    const config = useRuntimeConfig()
    if (config.public.invoiceEmailEnabled !== true) {
      return { result: { skipped: true, reason: 'feature_disabled' } }
    }
    if (!config.public.siteUrl || !config.invoiceEmailDispatchSecret) {
      return { result: { skipped: true, reason: 'missing_site_url_or_secret' } }
    }
    await $fetch(`${config.public.siteUrl}/api/internal/invoice-email/dispatch`, {
      method: 'POST',
      headers: {
        'x-invoice-email-dispatch-secret': config.invoiceEmailDispatchSecret,
      },
    })
    return { result: { skipped: false, reason: 'executed' } }
  },
})
