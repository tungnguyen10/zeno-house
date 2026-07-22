## Context

Zeno House already persists issued invoices and charge lines as authoritative snapshots, snapshots the building payment profile at issuance, and renders invoice data for detail and print surfaces. It also has a private `resendApiKey` runtime placeholder, Nitro scheduled tasks, service-role repositories, billing audit infrastructure, and primary-tenant contact email in `tenants.email`. No product action currently sends email, no PDF is generated on the server, and the contact email is intentionally independent from the tenant's Supabase Auth email.

Invoice issuance is a high-risk transactional workflow implemented through three database paths: period issue, issue-and-pay, and reissue. Resend is an external system and cannot participate in the Postgres transaction. Calling it synchronously inside issuance would create latency, partial-failure, and duplicate-send ambiguity. The delivery request therefore needs a durable boundary that is committed with the invoice while provider work happens afterward.

## Goals / Non-Goals

**Goals:**
- Send a Vietnamese HTML invoice summary with an A4 PDF attachment to the invoice's primary tenant contact email.
- Support manual single delivery, manual current-selection bulk delivery, and per-building automatic delivery after every supported issuance path.
- Preserve invoice issuance when a recipient or provider is unavailable and make every delivery outcome visible and retry-safe.
- Track provider acceptance and signed webhook outcomes without exposing secrets, private asset paths, or cross-building data.
- Roll out behind a global feature flag and a building toggle, both disabled by default.

**Non-Goals:**
- Sending to roommates, accepting an operator-entered recipient, or deriving the recipient from Supabase Auth.
- Marketing email, scheduled reminders, overdue campaigns, tenant reply ingestion, or payment reconciliation.
- Persisting generated PDFs, changing the existing browser print route, or recalculating issued charge snapshots.
- Making successful email delivery a prerequisite for issuing, paying, reissuing, or closing a billing period.

## Decisions

1. **Use a durable Postgres outbox with three focused tables.** `building_invoice_email_settings` stores one `auto_send_enabled` flag per building. `invoice_email_deliveries` is the canonical delivery record and work queue. `invoice_email_webhook_events` deduplicates at-least-once provider callbacks by `svix_id`. This reuses the configured Supabase workflow and avoids introducing a second queue service. Calling Resend synchronously or adding an external queue were rejected because the first couples billing to provider latency and the second adds unnecessary v1 infrastructure.

2. **Queue automatic delivery inside the invoice transaction.** A central `AFTER INSERT` invoice trigger reads the building setting and primary tenant contact email, then inserts either `queued` or `skipped`. It covers period issue, issue-and-pay, and reissue without duplicating application logic. The trigger never calls Resend and never rejects invoice creation because email is missing. The global application flag controls UI and dispatch; disabling it leaves queued work durable but unsent.

3. **Use an atomic enqueue/claim contract.** Manual single and bulk requests call one server-owned enqueue function after permission and building-scope checks. A partial unique index prevents more than one `queued`, `processing`, or `accepted` delivery for the same invoice and recipient. A terminal delivery does not block an explicit resend, which creates a new record and idempotency key. The worker claims up to 20 due rows with `FOR UPDATE SKIP LOCKED`, marks them `processing`, and reclaims a lease older than 10 minutes.

4. **Snapshot the recipient, not the complete document.** Each delivery stores the normalized `tenants.email` value present when it is queued. A later tenant email edit affects only a new explicit delivery. The document builder reads immutable invoice charges and invoice-profile snapshot data at dispatch time while using the invoice's current paid amount, balance, and derived status, matching the established print contract. A missing or invalid primary contact email produces a terminal `skipped` record with a machine-readable reason.

5. **Render HTML and PDF from one server document model.** A focused `InvoiceDocumentData` builder resolves invoice, period, building, tenant display, charge snapshots, current totals, and stored payment-profile asset paths. A plain escaped HTML renderer and a PDFKit renderer consume that model. PDFKit is preferred over headless Chromium because it runs in the existing Node/Nitro serverless runtime without browser binaries or authenticated page navigation. The existing Inter WOFF2 files are exposed as Nitro server assets for Vietnamese text. QR/logo bytes are downloaded server-side from the exact private Storage paths stored in the invoice snapshot; no client or arbitrary URL is accepted.

6. **Generate one invoice per A4 document without persistence.** The PDF uses a legible single-invoice A4 layout and continues onto another page rather than truncating exceptional content. It contains invoice/building/room/tenant identity, period and dates, charge table, total/paid/balance/status, snapshotted transfer instructions, QR/logo when available, and the existing neutral payment fallback otherwise. The buffer is attached as `hoa-don-<invoice-code>.pdf`, rejected above 10 MB, sent to Resend, and then discarded. The email body repeats the key totals and payment instructions so the attachment is not the only readable representation.

7. **Keep every provider retry inside Resend's idempotency window.** The delivery UUID is sent as a stable Resend idempotency key. The worker runs every minute with concurrency three and makes at most six provider calls: the initial attempt, then delays of 1 minute, 5 minutes, 30 minutes, 2 hours, and 6 hours. Network errors, HTTP 429, and HTTP 5xx are retryable. Authentication, invalid sender/domain, invalid recipient, invalid attachment, and other validation/configuration errors are terminal. A successful API response stores the Resend email ID and changes the state to `accepted`; accepted deliveries are never dispatched again.

8. **Treat signed webhooks as the delivery truth.** `POST /api/webhooks/resend` reads the raw body and verifies the Svix signature using the configured Resend webhook secret before parsing or mutating state. It handles `email.sent`, `email.delivered`, `email.failed`, `email.bounced`, and `email.complained`. A unique `svix_id` makes duplicate callbacks no-ops. `created_at` plus terminal-event precedence handles out-of-order callbacks: a newer failed, bounced, or complained event can supersede delivered, while an older sent event cannot regress it.

9. **Keep public API and permissions narrow.** Owner/admin can write the building setting; scoped managers can read it. Manual delivery requires `billing.write` plus invoice building scope and accepts one to 100 UUIDs or invoice codes. A void or inaccessible invoice is a per-item failure rather than a reason to abort other bulk items. Delivery history requires `billing.read` and scope. The internal dispatcher uses a private shared secret; the webhook uses only signature verification and provider identifiers.

10. **Separate operational history from billing audit summaries.** The delivery table is the detailed source for attempts, provider IDs, recipient snapshot, errors, and timestamps. Billing audit adds `invoice.email_queued`, `invoice.email_delivered`, and `invoice.email_failed` using `entity_type=invoice`; automatic/system outcomes have no fabricated actor. Logs contain delivery/invoice IDs, status, queue age, attempt count, and provider code while masking recipient addresses and omitting email bodies and PDF content.

11. **Use existing UI patterns and a staged rollout.** Building settings receives a focused automation card with an owner/admin toggle and manager read-only state. Invoice detail receives the recipient, single-send/resend action, and status timeline. Cross-period invoices and the monthly payment step reuse current active-invoice selection and sticky bulk-action patterns. Implementation must follow the Zeno House UI polish workflow, `frontend-design`, and Hallmark. The global `NUXT_PUBLIC_INVOICE_EMAIL_ENABLED` flag defaults false; building toggles also default false and enabling one never backfills older invoices.

## Risks / Trade-offs

- **Database trigger owns a small business decision** → keep it limited to deterministic enqueue/skipped creation and test all three issuance paths; provider behavior remains in services.
- **Queued work can accumulate while the global flag or dispatcher is off** → expose queue status, log oldest queue age, and process it only after operators deliberately re-enable dispatch.
- **Resend can accept a request when the application times out before recording the response** → reuse the same idempotency key for every retry and complete all attempts within 24 hours.
- **Webhook delivery is duplicated or unordered** → persist unique Svix IDs and compare provider event times before applying transitions.
- **PDF output can drift from the browser print component** → share the authoritative document-data builder and assert content, snapshot use, fallback, Vietnamese font, and overflow behavior independently.
- **Private images or malformed content can break rendering** → download only stored snapshot paths, validate MIME/size, escape HTML, and fall back safely when optional branding is unavailable.
- **Bulk sends can exceed serverless limits or provider rate limits** → enqueue only in browser requests and let a batch-20, concurrency-three worker perform provider calls.
- **Contact email changes after queueing** → preserve the original recipient for audit; a deliberate resend snapshots the updated address.

## Migration Plan

1. Add OpenSpec-backed migration objects, typed contracts, and static SQL verification while the global feature flag and all building toggles remain off.
2. Obtain explicit approval before installing `resend`, `pdfkit`, and TypeScript declarations; implement provider, renderer, queue, APIs, webhook, and UI behind the flag.
3. Apply the migration through the configured Supabase cloud workflow and regenerate `app/types/database.types.ts`; never edit the generated file manually.
4. Verify a Resend sender domain, then configure API key, sender, optional global reply-to, webhook secret, dispatcher secret, site URL, and webhook endpoint in staging.
5. Enable the global flag in staging, manually deliver controlled invoices, inspect PDF content, and observe accepted/delivered plus failure callbacks.
6. Enable the global flag in production with every building toggle still off, smoke-test one manual delivery, then enable automatic delivery building by building.
7. Roll back application behavior by disabling the global flag. Keep delivery/settings/event rows for recovery; only remove additive database objects after all deployed code no longer references them.

## Open Questions

None. Recipient, trigger, state, retry, PDF, permission, audit, and rollout behavior are decision-complete.
