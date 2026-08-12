## Context

Invoice charge lines are immutable snapshots, but receiving-bank instructions currently live nowhere in the billing model. The print route loads issued invoices in batches and the invoice drawer loads one invoice with charges/payments. The three invoice creation paths are database RPCs, so snapshot creation must happen inside those transactions after invoice-code allocation. QR and logo files are private assets and must never be replaced in place because historical invoices may reference them.

## Goals / Non-Goals

**Goals:**
- Give each building one current invoice profile and preserve its rendered value per invoice.
- Keep first configuration, legacy backfill, issuance, and audit behavior atomic at the database boundary.
- Expose private assets only through short-lived signed URLs after permission and building-scope checks.
- Produce a dense, legible, two-up A4 payment slip and align invoice detail with it.

**Non-Goals:**
- Uploading tenant transfer receipts or automatically reconciling bank payments.
- Deleting historical QR/logo objects or changing existing charge snapshots.
- Blocking issuance when a building has no invoice profile.

## Decisions

1. **Separate current profile plus JSON snapshot.** `building_invoice_profiles` stores one editable profile per building; `invoices.invoice_profile_snapshot` stores schema-versioned JSON. This avoids widening `buildings`, keeps history immutable, and does not require a version table.
2. **Snapshot inside every invoice insert transaction.** A shared SQL renderer replaces the four supported tokens after invoice-code allocation. A `BEFORE INSERT` trigger on `invoices` applies the renderer centrally, so period issue, issue-and-pay, and reissue cannot drift and write either the complete snapshot or `NULL` in their existing transaction.
3. **One-time legacy fill.** The first profile upsert locks the building/profile, fills only non-void invoices with a null snapshot, and records `legacy_backfilled_at`. Later saves never rewrite invoices. A replacement invoice uses the profile current at reissue time.
4. **Single multipart save workflow.** Initial save requires bank fields, template, and QR. Updates preserve omitted assets and support an explicit logo reset. Storage upload precedes the database call; newly uploaded files are removed if persistence fails. Previously committed objects remain append-only.
5. **Private asset boundary.** The client receives signed URLs, never storage paths. Profile reads require the new read capability plus building scope; writes require the write capability. Invoice print/detail continue to authorize with `billing.read` and scope before signing snapshot assets.
6. **Existing visual system, compact document.** Building settings receives one focused section using current primitives and dark/cyan tokens. The print artifact remains neutral white paper, uses a six-column charge table, a compact QR footer, and fixed two-up pagination.

## Risks / Trade-offs

- **Append-only assets increase storage use** → retain historical correctness now and defer reference-aware garbage collection.
- **Signed URLs may expire while a tab remains open** → use a practical short TTL and refresh them on every detail/print-data load.
- **Two-up layout can overflow with many charges** → preserve the card boundary, use compact rows, and surface overflow in component/print tests; unusually long invoices remain one card and may consume a full page through print CSS.
- **Invoice creation paths can drift** → keep snapshotting behind one `BEFORE INSERT` trigger and cover all three existing functions plus the shared renderer with migration assertions.
- **Storage and Postgres are not one transaction** → remove only newly uploaded request assets on DB failure; never delete committed versions.

## Migration Plan

1. Create the profile table, invoice snapshot column, private bucket/policies, shared renderer, profile upsert/backfill RPC, and the central invoice-insert trigger covering every invoice-creation RPC.
2. Regenerate database types after the migration is applied through the configured Supabase workflow.
3. Deploy server APIs/services before exposing the settings section; old invoices and profile-less buildings remain valid.
4. Rollback application code independently. Database rollback removes only new functions/table/column when no deployed code depends on them; stored assets are retained for recovery.

## Open Questions

None. Product and migration behavior are decision-complete.
