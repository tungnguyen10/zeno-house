## Why

Issued invoices can currently be viewed or printed only from the authenticated operations app. Operators need a reliable way to send the immutable invoice artifact to the primary tenant by email, both on demand and automatically after issuance, without making billing transactions depend on an external email provider.

## What Changes

- Add building-scoped invoice-email settings with automatic sending disabled by default and a global production-safe feature flag.
- Add manual single and current-selection bulk email actions for active invoices, using the primary tenant's stored contact email without recipient override or roommate CC.
- Add a durable Supabase delivery outbox that atomically queues automatic delivery for period issue, issue-and-pay, and reissue while keeping invoice issuance successful when email is unavailable.
- Add a bounded Nitro dispatcher that renders a Vietnamese HTML summary and a server-generated A4 PDF, sends through Resend with idempotency, and retries transient failures.
- Add signed Resend webhook handling and delivery history for accepted, delivered, failed, bounced, complained, and skipped outcomes.
- Add invoice email audit events, operator-visible delivery status, and staged rollout guidance.
- Keep PDF generation ephemeral; no invoice PDF is persisted to Storage.

## Capabilities

### New Capabilities
- `invoice-email-delivery`: Building settings, recipient policy, durable queueing, Resend dispatch, PDF attachment, delivery tracking, permissions, audit, and rollout behavior.

### Modified Capabilities
- `monthly-billing-database`: Every supported invoice creation path atomically queues automatic email delivery when the building setting is enabled.
- `invoices-browse`: Invoice detail and current-page selections expose manual email delivery and delivery history.
- `monthly-operations-workspace`: The issued-invoice payment step supports manual single and bulk email delivery.
- `buildings-ui`: Building settings expose an owner/admin automatic invoice-email toggle and a manager read-only state.

## Impact

- Adds two public delivery/settings tables, one webhook-deduplication table, claim/enqueue database functions or triggers, indexes, RLS policies, and billing audit actions.
- Adds private runtime configuration for Resend, webhook verification, and the dispatcher plus a non-secret global feature flag that defaults off.
- Adds validators, DTOs, repository/service/API paths, a Nitro scheduled task, a Resend webhook endpoint, HTML rendering, and a PDF renderer.
- Adds `resend`, `pdfkit`, and the required TypeScript declarations only after explicit dependency-install approval during implementation.
- Changes building settings, invoice detail, cross-period invoice selection, and the monthly payment workspace without changing invoice calculation, payment, print-route, or tenant-portal semantics.
