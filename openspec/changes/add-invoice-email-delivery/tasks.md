## 1. Contracts and database foundation

- [x] 1.1 Add invoice-email status/source constants, DTOs, Zod request/response validators, mapper contracts, runtime flags, and `invoice-email-settings.read/write` capability coverage with focused unit tests.
- [x] 1.2 Create an additive Supabase migration for `building_invoice_email_settings`, `invoice_email_deliveries`, and `invoice_email_webhook_events`, including constraints, indexes, deny-by-default RLS, safe grants, automatic invoice-insert enqueue, active-delivery uniqueness, atomic manual enqueue/claim functions, and billing email audit actions.
- [x] 1.3 Add SQL/static verification for default-off settings, recipient snapshots and skipped rows, transaction rollback, active-delivery deduplication, lease reclaim, webhook-event uniqueness, audit writes, and all three issuance paths: period issue, issue-and-pay, and reissue.
- [ ] 1.4 Apply the migration through the configured Supabase cloud workflow, run its verification queries, then regenerate `app/types/database.types.ts` instead of editing the generated type file manually.

## 2. Dependencies and invoice document rendering

- [x] 2.1 Stop for explicit user approval, then install `resend`, `pdfkit`, and the required TypeScript declarations without unrelated dependency upgrades.
- [x] 2.2 Implement and test one server-owned `InvoiceDocumentData` builder that resolves authorized invoice, period, building, primary tenant, persisted charges, current collection totals/status, and stored invoice-profile asset paths without exposing private paths in API DTOs.
- [x] 2.3 Implement and test an escaped Vietnamese HTML invoice renderer with global sender/optional reply-to configuration, key totals, due date, and snapshotted payment instructions plus neutral fallbacks.
- [x] 2.4 Configure a licensed Inter variable TTF as a Nitro server asset and implement a PDFKit A4 renderer with charge overflow continuation, QR/logo private Storage downloads, fallback branding/payment copy, deterministic filename, buffer cleanup, and a 10 MB guard.
- [x] 2.5 Add renderer tests for Vietnamese glyphs, HTML escaping, snapshot immutability, current paid/balance values, meter and charge content, missing/corrupt assets, multi-page overflow, and attachment limits.

## 3. Settings and manual delivery APIs

- [x] 3.1 Implement building email-settings repository, mapper, service, `GET/PUT /api/buildings/[id]/invoice-email-settings`, owner/admin write permission, manager scoped read permission, and default-off behavior.
- [x] 3.2 Include feature availability and invoice-email settings in the existing building settings bootstrap without adding a browser-side Supabase query or an avoidable initial request.
- [x] 3.3 Implement delivery repository and enqueue service with `billing.write`, building scope, UUID/code resolution, one-to-100 validation, void rejection, recipient snapshot/skipped result, active-job reuse, explicit resend after terminal outcomes, and per-item bulk results.
- [x] 3.4 Add `POST /api/billing/invoices/email-deliveries` and scoped `GET /api/billing/invoices/[id]/email-deliveries` using the standard API envelope and safe not-found behavior.
- [x] 3.5 Add service/API tests for roles, scope, global feature gating, single/bulk mixed results, recipient changes, missing email, active deduplication, terminal resend, void handling, history ordering, and sensitive-field exclusion.

## 4. Resend dispatch and webhook tracking

- [x] 4.1 Implement a server-only Resend adapter that sends HTML plus the PDF buffer with the delivery UUID as idempotency key, maps accepted IDs and documented provider errors, respects optional global reply-to, and never logs content or unmasked recipient data.
- [x] 4.2 Implement the batch-20, concurrency-three dispatcher with atomic leases, a 10-minute stale lease, retry delays of 1 minute, 5 minutes, 30 minutes, 2 hours, and 6 hours, six total provider calls, and terminal classification for non-retryable failures.
- [x] 4.3 Add a secret-protected internal dispatch endpoint and a one-minute Nitro scheduled task; missing config or a disabled global feature flag must preserve queued jobs and return a safe skipped result.
- [x] 4.4 Implement `POST /api/webhooks/resend` using raw-body Svix signature verification, unique event persistence, Resend email-ID matching, event-time ordering, terminal precedence, and handling for sent, delivered, failed, bounced, and complained events.
- [x] 4.5 Append concise `invoice.email_queued`, `invoice.email_delivered`, and `invoice.email_failed` billing audit entries and extend audit category/summary rendering without adding intermediate webhook noise.
- [x] 4.6 Add provider, dispatcher, internal endpoint, and webhook tests for success, timeouts after provider acceptance, 429/5xx retry, permanent errors, stale claims, concurrent workers, stable idempotency, invalid signatures, duplicates, out-of-order events, bounce/complaint supersession, and masked structured logs.

## 5. User interface and delivery workflow

- [x] 5.1 Before UI edits, read and apply the Zeno House UI polish workflow, `frontend-design`, Hallmark, frontend architecture, and design-system guidance; preserve existing primitives, tokens, typography, and icon conventions.
- [x] 5.2 Add the building-settings automatic invoice-email card with owner/admin toggle, manager read-only state, future-invoices-only explanation, confirmation, loading/error/success states, and global-feature-disabled behavior.
- [x] 5.3 Add typed invoice-email composables for enqueue and scoped history with explicit in-flight dedupe, no automatic mutation retry, standard API errors, and refresh of affected delivery state.
- [x] 5.4 Add the invoice-detail recipient, **Gửi email**/**Gửi lại** action, active-state protection, unavailable-recipient guidance, and newest-first delivery timeline while preserving the read-only billing contract.
- [x] 5.5 Extend cross-period invoices and the monthly payment step with active-only current-page selection, **Gửi email (N)** confirmation, maximum-100 enforcement, per-result summary, selection reset, and independence from print/payment actions.
- [ ] 5.6 Add component/page/composable tests for permissions, toggle states, single/resend/bulk flows, queued/accepted/delivered/skipped/failed/bounced/complained states, partial results, loading/error/empty behavior, mobile layouts, keyboard access, and reduced motion.
- [ ] 5.7 Perform browser visual verification at mobile and desktop widths plus PDF inspection for normal, missing-profile, long-charge, logo, QR, error, and disabled-feature states; resolve frontend-design and Hallmark findings before completion.

## 6. Documentation, rollout, and verification

- [x] 6.1 Update billing, API, database, auth/permissions, environment setup, project status, and operational rollout documentation; regenerate the API inventory and document sender-domain/webhook/dispatcher configuration without committing secrets.
- [ ] 6.2 Verify staging with the global flag on and building auto-send off: manually send a controlled invoice, inspect its HTML/PDF, and confirm accepted plus delivered webhook state before testing transient and terminal failures.
- [ ] 6.3 Enable and verify automatic sending for one staging building across period issue, issue-and-pay, and reissue, confirming that invoice transactions remain successful for missing recipients and provider outages.
- [x] 6.4 Run narrow unit/component/server/SQL tests, `openspec validate --specs`, change validation, `npm run typecheck`, full `npm test`, and `npm run lint`; resolve every regression and keep production/global plus per-building defaults off for deployment.
- [x] 6.5 Run final spec-to-implementation, security, reliability, and UI polish review, then record the production enablement sequence: global flag first, one manual smoke delivery, followed by building-by-building auto-send activation.
