# Scheduled Workers

Production scheduler wake-ups are owned by Supabase Cron, not Nitro or Vercel Cron. Supabase
`pg_cron` uses `pg_net` to POST to existing protected Nitro endpoints; Nitro retains all business
work, feature gates, retries, and response handling.

## Required Supabase Vault Values

After applying `20260727103000_migrate_nitro_schedulers_to_supabase_cron.sql`, create these values
in every environment:

- `nitro_scheduler_base_url`: deployed application origin without a trailing slash.
- `invoice_email_dispatch_secret`: matches `NUXT_INVOICE_EMAIL_DISPATCH_SECRET`.
- `operations_report_auto_close_secret`: matches `NUXT_OPERATIONS_REPORT_AUTO_CLOSE_SECRET`.
- `ai_retention_cleanup_secret`: matches `NUXT_AI_RETENTION_CLEANUP_SECRET`.

Never add a URL or secret value to migrations. Rotate a worker secret by updating Vault and the
matching Nitro runtime configuration, then manually invoking its endpoint before retiring the old value.

## Schedules

| Job | Schedule | Private endpoint |
| --- | --- | --- |
| `invoice-email-dispatch-every-minute` | Every minute | `/api/internal/invoice-email/dispatch` |
| `operations-report-auto-close` | `16:55 UTC` | `/api/internal/operations-report/auto-close` |
| `ai-retention-cleanup` | `17:20 UTC` | `/api/internal/ai/retention-cleanup` |

Inspect `cron.job` for configuration and `cron.job_run_details` for wake-up history. A failed
`pg_net` wake-up leaves worker state unchanged and the next scheduled run retries.

## Local Invocation

Run Nuxt with the relevant private secret, then invoke a worker directly:

```bash
curl -X POST https://localhost:<port>/api/internal/invoice-email/dispatch \
  -H "x-invoice-email-dispatch-secret: $NUXT_INVOICE_EMAIL_DISPATCH_SECRET"
```

Use `x-operations-report-cron-secret` or `x-ai-retention-secret` with their matching values for
the other endpoints. Local development does not run a scheduler automatically.

## Local Invoice Dispatcher Verification

On 2026-07-27, a manual local invocation of the invoice dispatcher successfully claimed two due
outbox deliveries and Resend accepted both (`claimed: 2`, `accepted: 2`, with no retries or
failures). This verifies the protected local endpoint, dispatcher, provider configuration, and
outbox claim path.

`accepted` means Resend accepted the send request; it is not a delivery confirmation. Confirm
`delivered_at` only after the configured Resend webhook records the provider delivery event.
Supabase Cron itself remains a production-only check: deploy the application, confirm the
production endpoint returns JSON rather than a login page, then inspect `cron.job_run_details`,
`net._http_response`, and `invoice_email_deliveries`.
