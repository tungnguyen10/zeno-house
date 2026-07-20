## 1. Contracts and database

- [x] 1.1 Add validator, DTO, mapper contracts, capabilities, and focused unit tests for invoice profiles and template variables.
- [x] 1.2 Create the Supabase migration for profile storage, private assets, immutable snapshots, first-save backfill, audit semantics, and a central trigger covering all three issuance RPCs.
- [x] 1.3 Isolate pending generated database types behind a typed repository contract and add migration/static tests for snapshot and backfill invariants. Regenerate the generated file only after applying the migration to the configured Supabase project.

## 2. Server behavior

- [x] 2.1 Implement profile repository/service/API with scoped read/write permissions, multipart validation, signed URLs, unique uploads, logo reset, and failure cleanup.
- [x] 2.2 Extend invoice detail and batch print services to resolve signed payment-snapshot assets without exposing storage paths.
- [x] 2.3 Add service/API tests for permissions, scope, uploads, cleanup, profile absence, immutable snapshot display, and batch signing.

## 3. User interface

- [x] 3.1 Add the polished building-settings invoice-profile section with editable and read-only states, previews, validation, upload states, and responsive behavior.
- [x] 3.2 Preserve and improve the invoice detail drawer while adding the read-only snapshot payment card and missing-snapshot state.
- [x] 3.3 Rebuild the two-up A4 print card with branding, the six-column charge table, totals, payment footer, fallback state, and print-safe overflow behavior.
- [x] 3.4 Add component tests for building settings, drawer snapshots, meter metadata columns, asset fallbacks, and print states.

## 4. Documentation and verification

- [x] 4.1 Update accepted specs and billing, API inventory, database, permissions, and project-status documentation.
- [x] 4.2 Run narrow tests, OpenSpec validation, typecheck, full tests, lint, and static responsive/A4 review; resolve all regressions. Live browser/print-preview smoke checking remains part of deployment because no browser runtime is available in this session.
- [x] 4.3 Perform final code/UI review, mark local implementation tasks complete, and commit the implementation on local main.
