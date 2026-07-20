## Why

Issued invoices currently preserve charge data but do not preserve the building's receiving-bank identity or QR code. Operators therefore cannot publish a stable payment instruction on the invoice, and changing building settings could otherwise rewrite historical artifacts.

## What Changes

- Add a building-scoped invoice profile containing bank details, a transfer-content template, an owner-uploaded QR image, and an optional building logo.
- Snapshot the profile atomically whenever an invoice is issued, including issue-and-pay and reissue flows.
- Backfill active legacy invoices exactly once when a building profile is first configured, without mutating later snapshots.
- Expose scoped read/update APIs and a polished building-settings editor with admin/owner write access and manager read access.
- Upgrade invoice detail and the two-up A4 print artifact to show the immutable payment snapshot and a six-column charge table.
- Keep invoice issuance and printing available when no profile snapshot exists, with an explicit neutral fallback message.

## Capabilities

### New Capabilities
- `building-invoice-profile`: Building payment identity, private QR/logo assets, permissions, API behavior, and first-configuration legacy backfill.

### Modified Capabilities
- `monthly-billing-database`: Issuance transactions persist the immutable invoice-profile snapshot across every invoice creation path.
- `invoice-printing`: Printable invoices use the payment snapshot and the new two-up six-column payment-slip layout.
- `invoices-browse`: Invoice detail exposes payment instructions and QR/logo from the invoice snapshot.

## Impact

- Adds one public table, one invoice JSONB column, one private Storage bucket, and a central invoice-insert trigger covering the three invoice-creation RPCs.
- Adds building invoice-profile validators, DTOs, mapper/repository/service/API paths, signed asset URL generation, and audit semantics.
- Changes building settings, invoice detail, and invoice print UI while preserving current invoice/payment mutations.
- Updates billing, API, database, permission, and project-status documentation; no new runtime dependency is required.
