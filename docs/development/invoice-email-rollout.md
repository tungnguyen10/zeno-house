# Invoice Email Delivery Rollout

Invoice email has two independent default-off controls:

1. `NUXT_PUBLIC_INVOICE_EMAIL_ENABLED=false` stops manual enqueue, worker claims, and settings
   activation while preserving queued rows.
2. Each `building_invoice_email_settings.auto_send_enabled` value defaults to `false` and affects
   only invoices inserted after it is enabled.

## Required Configuration

- Apply `supabase/migrations/20260723103000_add_invoice_email_delivery.sql` in Supabase Dashboard
  SQL Editor.
- Run `supabase/verification/invoice_email_delivery.sql`, then regenerate
  `app/types/database.types.ts` from that cloud project.
- Configure `NUXT_RESEND_API_KEY` and a Resend-verified `NUXT_RESEND_FROM`.
- Optionally configure `NUXT_RESEND_REPLY_TO`.
- Create the Resend webhook for `POST /api/webhooks/resend`, subscribe to `email.sent`,
  `email.delivered`, `email.failed`, `email.bounced`, and `email.complained`, then configure
  `NUXT_RESEND_WEBHOOK_SECRET`.
- Generate a high-entropy `NUXT_INVOICE_EMAIL_DISPATCH_SECRET`, then store the same value as
  `invoice_email_dispatch_secret` in Supabase Vault. Store the deployed origin as
  `nitro_scheduler_base_url`; Supabase Cron calls the secret-protected endpoint once per minute.
- Apply `supabase/migrations/20260727103000_migrate_nitro_schedulers_to_supabase_cron.sql` and run
  `supabase/verification/nitro_schedulers_pg_cron.sql`. See [Scheduled Workers](./scheduled-workers.md).
- Keep every secret in server runtime configuration; never commit it or use `NUXT_PUBLIC_*`.

## Staging Sequence

1. Deploy with the migration applied, global flag off, and every building auto-send off.
2. Configure provider, webhook, Supabase Vault scheduler values, and dispatch secret.
3. Turn the global flag on while leaving building auto-send off.
4. Manually send one controlled invoice. Inspect the HTML and PDF against the invoice print artifact:
   title/status, room/tenant/date metadata, six charge columns including meter readings, totals,
   issue-time payment instructions, PDF pagination, and CID logo/QR fallbacks.
5. Confirm the row advances from queued/accepted to delivered after the webhook.
6. Exercise one retryable provider failure and one permanent failure. Confirm bounded retry,
   stable delivery UUID, masked errors, and no duplicate accepted email.
7. Enable auto-send for one staging building. Verify period issue, issue-and-pay, and reissue.
8. Repeat with missing/malformed tenant email and simulated provider outage; invoice transactions
   must still commit and delivery rows must be skipped or retained for retry.

## Resend Behavior

- The existing bulk action remains for initial manual sends only and accepts one to 100 invoices.
- A resend is a single-invoice action. It creates a new delivery linked to the previous attempt and
   never resets or deletes the prior provider outcome.
- A `failed` delivery can be resent directly. An `accepted` or `delivered` delivery requires an
   explicit duplicate-delivery confirmation because the tenant may receive another email.
- Do not resend `bounced` or `complained` deliveries. Correct the tenant email or review the
   complaint before attempting a new delivery.
- `accepted` means Resend accepted the request; it does not mean delivery was confirmed. A webhook
   `email.delivered` event is required before the UI shows `Đã giao`. Local development needs a
   public tunnel to receive this event directly; otherwise validate the webhook against the deployed
   endpoint sharing the same Supabase project.

## Production Sequence

1. Apply and verify the migration; deploy with the global flag off.
2. Configure and verify sender, webhook, dispatch secret, and scheduler.
3. Turn on only the global flag.
4. Run one manual smoke delivery and confirm the delivered webhook state.
5. Enable auto-send building by building, monitoring failed, bounced, and complained outcomes.
6. Turn the global flag off to stop new manual work and worker claims during an incident. Queued
   rows remain durable and resume when the flag is restored.

Do not enable automatic delivery globally for existing buildings through SQL. Activation is an
explicit per-building product decision after the manual smoke delivery succeeds.
