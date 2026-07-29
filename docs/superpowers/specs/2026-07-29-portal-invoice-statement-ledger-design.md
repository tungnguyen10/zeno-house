# Portal Invoice Statement Ledger Design

## Goal

Polish `/portal/invoices` and `/portal/invoices/[id]` into a production-ready statement-history experience while preserving the existing MapTrack portal design system, tenant API behavior, invoice ordering, and payment-snapshot rules.

## Audience, Job, And Tone

- **Audience:** tenants reviewing current and historical housing invoices on mobile first, with desktop portal support.
- **Primary job:** find an invoice by period, understand its payment state, and open a trustworthy invoice detail.
- **Tone:** calm, precise, document-like, and customer-facing.

The surface is a statement history, not an internal debt-management workspace. It must not add operational filters, search, bulk actions, invented analytics, or dashboard-style KPI tiles.

## Scope

### Included

- Restructure the `/portal/invoices` presentation from a card grid into a chronological statement ledger.
- Polish the invoice detail summary into a document-like payment statement.
- Improve hierarchy, spacing, date formatting, responsive behavior, interaction affordance, loading, empty, and error states.
- Preserve pull-to-refresh and the existing detail navigation.
- Preserve the recently added transfer-instruction behavior for outstanding, paid, void, missing-snapshot, missing-QR, copy-loading, copy-success, and copy-error states.

### Excluded

- No API, database, DTO, mapper, repository, or service changes.
- No filtering, searching, sorting controls, pagination changes, or grouping preference.
- No payment submission or mutation.
- No dashboard changes.
- No new theme, font, design token, shared primitive, or external dependency.

## Design Direction

### Existing System

The implementation must use the current MapTrack portal light/dark variables, Inter typography, portal type and money utilities, status mapping, `PortalStatusBadge`, portal feedback surfaces, and `nuxt-svgo` icons. Generic design guidance must not create standalone Hallmark artifacts or parallel design-system files.

### Signature

The distinguishing element is a year-grouped statement ledger: one continuous document surface per year, with aligned invoice rows and restrained separators. It replaces the current repeated tile rhythm with a structure that communicates chronology.

## `/portal/invoices`

### Page Introduction

The content begins with a compact introduction:

- title: `Lịch sử hoá đơn`;
- supporting copy explaining that invoices are ordered from newest to oldest;
- honest count derived from the loaded invoice data.

The introduction is not a card and does not contain invented totals or KPI claims.

### Year Grouping

Invoices remain in the order returned by the existing composable. The page groups consecutive invoices by `periodYear` for presentation only.

- Each year is a semantic `h2`.
- Each year owns one ledger surface.
- The UI does not silently re-sort invoices.
- Empty groups are never rendered.

### Ledger Row

Each invoice is one full-width interactive row. The entire row navigates to `/portal/invoices/[id]`; it contains no nested interactive control.

Content hierarchy:

1. **Period marker:** month number and short `THÁNG` label.
2. **Identity:** invoice code and formatted due date.
3. **Payment context:** total amount and paid amount.
4. **Primary amount:** outstanding balance when positive, otherwise total invoice value.
5. **State and affordance:** existing status badge and a chevron.

The primary amount label is `Còn phải thanh toán` for positive balances and `Tổng hoá đơn` otherwise. Currency uses existing portal tabular-number utilities.

### Responsive Composition

- At 320–414px, each row uses two visual tiers: period/identity/state first, amounts second.
- At 768px and wider, rows align to stable grid columns so periods, totals, and statuses can be scanned vertically.
- Long invoice codes truncate safely with title disclosure where useful.
- Clickable labels remain single-line.
- No horizontal scrolling is introduced.
- Each row has a minimum 44px touch target, visible focus ring, pressed state, and reduced-motion-safe transitions through the existing interactive portal conventions.

### States

- **Loading:** ledger-shaped skeleton rows rather than six unrelated statement cards.
- **Error:** existing portal error surface with a clear retry action.
- **Empty:** calm explanation that issued invoices will appear here.
- **Default:** grouped ledger.
- **Refresh:** existing pull-to-refresh behavior remains.

## `/portal/invoices/[id]`

### Statement Summary

The first surface reads as an invoice document header, not a dashboard metric card.

Header:

- billing period and invoice code;
- existing status badge;
- room and building identity;
- formatted issue and due dates.

Financial hierarchy:

- one primary amount: outstanding balance when positive, otherwise invoice total;
- one compact progress rail representing `paidAmount / totalAmount`;
- concise `Đã thanh toán` and `Tổng cộng` values beneath the rail;
- `Còn lại` is shown only when positive.

The progress rail is built locally with existing theme/status classes and ARIA progress semantics. It is not promoted into a reusable primitive because there is one stable call site. A circular chart is not used because it would be decorative and would compete with the invoice amount.

### Content Order

1. Statement summary.
2. Void explanation when the invoice is void.
3. Outstanding transfer instructions when an active invoice has a positive balance.
4. Charge breakdown.
5. Read-only transfer snapshot history when the invoice is paid.
6. Notes when present.

This preserves current payment-snapshot security and status behavior.

### Charge Breakdown

- Retain grouping through `groupChargeLines`.
- Use one continuous surface with group labels and dividers.
- Keep quantity, unit, unit price, and line amount readable without nested cards.
- The final invoice total is the closing row.
- Use semantic `h2` section titles and lists/descriptions appropriate to the data.

### Responsive And Accessibility

- Summary metadata collapses naturally without fixed-width overflow.
- Money values use tabular figures and safe wrapping.
- Progress uses `role="progressbar"` with `aria-valuemin`, `aria-valuemax`, and a bounded `aria-valuenow`.
- Transfer copy controls retain ≥44px targets, loading lockout, success feedback, failure feedback, focus visibility, and safe long-text wrapping.
- QR remains bounded with explicit dimensions.
- No action depends on hover.
- All portal theme colors continue to resolve through existing semantic classes and CSS variables.

## Data And Behavior

No server or composable contract changes are required.

- List data continues through `usePortalInvoices()`.
- Detail data continues through `usePortalInvoiceDetail(id)`.
- Invoice status styles continue through `portalInvoiceStatementAccent` and `PortalStatusBadge`.
- Dates use `formatViDate`.
- Currency uses the current portal currency helpers.
- The list uses computed year grouping only; source data is not mutated.

## Expected Files

- Modify `app/pages/portal/invoices/index.vue`.
- Modify `app/pages/portal/invoices/[id].vue`.
- Modify `tests/pages/portal-invoices.spec.ts`.
- Modify `tests/pages/portal-invoice-detail-ui.spec.ts`.
- Update `openspec/specs/tenant-portal-ui/spec.md` only where the accepted visual/interaction behavior needs explicit coverage.
- Update `openspec/changes/refresh-tenant-portal-ui/tasks.md`.

No production file is deleted.

## Testing And Verification

Use test-first development.

List coverage:

- year grouping preserves returned order;
- ledger rows show period, code, formatted due date, amount context, status, and navigation affordance;
- mobile and desktop layout contracts are present;
- loading uses ledger-shaped placeholders;
- error, empty, and pull-to-refresh behavior remain;
- no filter/search controls or tile grid remain.

Detail coverage:

- statement summary contains document identity and formatted dates;
- progress is clamped to 0–100 and exposes ARIA semantics;
- monetary hierarchy avoids duplicate headline amounts;
- outstanding, paid-history, void, missing-snapshot, missing-QR, copy-loading, copy-success, and copy-error behavior remains;
- charge breakdown stays divider-led and semantic.

Final verification:

- focused portal invoice page/component tests;
- `openspec validate --specs`;
- `npm run typecheck`;
- `npm run lint`;
- full `npm test -- --exclude '.worktrees/**'`;
- responsive source and rendered checks at 320, 375, 414, and 768px when an authenticated runtime is available;
- final Hallmark critique for philosophy, hierarchy, execution, specificity, restraint, and structural variety.
