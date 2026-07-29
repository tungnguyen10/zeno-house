# Portal Debt Action Design

## Goal

Make the tenant portal home action-first after the room keycard, and let tenants safely copy immutable invoice transfer instructions from their own invoice detail.

## Scope

- Refine `/portal` only; do not change dashboard UI or dashboard behavior.
- Extend `/portal/invoices/[id]` with payment-profile snapshot content.
- Extend the tenant invoice-detail DTO/service response with the already-existing immutable invoice profile snapshot.
- Keep the current MapTrack portal light/dark design system and existing portal primitives.
- Do not add a payment-submission workflow, a new theme, new tokens, or a new generic primitive.

## Portal Home

The page keeps the room keycard as its visual anchor. The date is removed because it competes with the room identity without helping the tenant complete a task.

Immediately after the keycard:

- If the newest invoice has a positive balance, the section is titled `Công nợ cần xử lý`.
- Otherwise it is titled `Hoá đơn mới nhất`.
- The whole invoice statement remains one touch target and gains an explicit `Xem chi tiết` affordance.
- Due dates use the shared Vietnamese date formatter.

The financial history is one coherent card: chart first, then a divider-led two-column metric strip for average monthly amount and paid ratio. The separate nested-looking metric cards are removed.

The duplicate request/profile quick-action cards are removed because those destinations already exist in primary portal navigation.

The page uses one shared bootstrap error state. A failed bootstrap must never appear as “no contract” or “no invoices”; it shows an error empty state with `Thử lại`. Loading placeholders match the actual room keycard and invoice statement height. Section headings use `h2`.

## Invoice Detail

### Outstanding invoices

For `issued`, `partial`, or derived `overdue` invoices with a positive balance, `Thanh toán chuyển khoản` appears directly after the summary and before charge details. It contains:

- the exact remaining amount;
- bank name and account holder;
- account number and rendered transfer content;
- a QR image when the snapshot has a signed QR URL;
- copy buttons for account number and transfer content.

Copy controls use at least 44px touch targets, visible focus rings, concise accessible labels, and the portal-scoped toast host. Clipboard failure shows an actionable error instead of silently succeeding.

### Paid invoices

For `paid` invoices, the snapshot is placed after charge details as secondary historical information. It omits the QR, outstanding amount, and copy actions to avoid inviting a duplicate transfer.

### Void invoices

For `void` invoices, payment instructions are hidden. A clear void notice shows the stored reason when available.

### Snapshot fallbacks

If the invoice has no valid snapshot, the portal explains that payment details were not stored and directs the tenant to contact management. It never substitutes the building’s current profile. If only the QR asset is unavailable, the immutable text details remain visible with a `QR chưa khả dụng` fallback.

## Data Flow And Security

The existing flow remains:

`portal page -> portal composable -> /api/tenant/invoices/[id] -> TenantInvoiceService -> repositories`

`TenantInvoiceService.getDetail` must first resolve the tenant/roommate scope and load the scoped invoice. Only after that succeeds may it:

1. load the snapshot for the confirmed invoice ID;
2. resolve short-lived signed asset URLs through `InvoiceProfileDisplayService`;
3. map the result to `TenantInvoiceDetail.invoiceProfile`.

Cross-tenant or missing invoice requests return the existing not-found response before any snapshot lookup. Missing or invalid snapshots map to `null`.

## Responsive And Accessibility

- The component is mobile-first and must not overflow at 320, 375, 414, or 768 CSS pixels.
- Long account numbers and transfer content wrap safely.
- QR uses an explicit square aspect and a bounded size.
- Interactive labels stay on one line.
- No action depends on hover.
- Existing portal light/dark CSS variables remain the only color source.
- No nested interactive controls are placed inside an interactive card.

## Verification

- TDD coverage for scoped snapshot resolution and DTO mapping.
- Component/source tests for outstanding, paid, void, missing-snapshot, missing-QR, copy success, and copy failure states.
- Portal-home tests for global error handling, action-first invoice copy, integrated finance card, semantic headings, formatted date, and removal of duplicate quick actions.
- `openspec validate --specs`
- focused portal and tenant service tests
- `npm run typecheck`
- `npm run lint`
- full `npm test -- --exclude '.worktrees/**'`
- final Hallmark self-critique and responsive source review.
