---
type: Capability Specification
title: "tenant-portal-ui"
status: stable
tags: [capability, requirements]
sources:
  - resource: "https://github.com/tungnguyen10/zeno-house/blob/ae95811bbdc1932368b4e6b9ed3e9540399d26e6/openspec/specs/tenant-portal-ui/spec.md"
generated:
  by: "process:okf-migration"
  at: "2026-11-06T00:00:00Z"
---

# tenant-portal-ui Specification

## Purpose
Define the mobile-first, self-scoped tenant experience for housing, invoices, support, profile and private documents. Production-completion behavior is reconciled with locally tested source; deployed journeys and physical-device verification remain tracked in the [active portal change](../changes/tenant-portal-production/index.md).
## Requirements
### Requirement: Isolated tenant mobile shell
The system SHALL provide a tenant-only mobile layout under `/portal` that does not render any internal shell component (no `AppSidebar`, no internal AI dev chat). Portal pages SHALL be mobile-first with explicit loading, empty, and error states and touch-appropriate controls.

#### Scenario: Portal uses tenant layout
- **WHEN** a `tenant` user opens any `/portal` route
- **THEN** the tenant mobile layout renders without internal shell components

#### Scenario: Data regions handle all states
- **WHEN** a portal data region loads, is empty, or errors
- **THEN** the page shows the corresponding loading/empty/error state

---

### Requirement: Native-like app shell
The tenant portal SHALL present a native-like app shell rather than a scrolling web page. It SHALL set `viewport-fit=cover` and apply `env(safe-area-inset-*)` padding so a fixed mobile bottom tab bar and a sticky header respect the device notch and home indicator. Mobile primary navigation SHALL have touch targets of at least 44px and an active indicator; desktop MAY use the portal's own navigation rail. Content SHALL be the only scrolling region, and route changes SHALL use page transitions that respect `prefers-reduced-motion`.

#### Scenario: Safe areas respected
- **WHEN** the portal renders on a device with a notch or home indicator
- **THEN** the header and bottom tab bar are padded by the safe-area insets and no control is obscured

#### Scenario: Bottom tab navigation
- **WHEN** a tenant navigates the portal on a mobile viewport
- **THEN** a fixed bottom tab bar provides primary navigation with ≥44px targets and an active indicator, and no desktop sidebar is shown

#### Scenario: Reduced motion respected
- **WHEN** the user prefers reduced motion
- **THEN** route transitions are minimized or disabled

---

### Requirement: Touch-first interactions
The portal SHALL use touch-first interaction patterns: modals SHALL be bottom sheets rather than centered desktop dialogs; lists SHALL use skeleton loaders instead of spinners and SHALL support pull-to-refresh on the invoices and requests lists; lightweight mutations SHALL use optimistic UI with rollback on error; and no action SHALL depend on hover. Portal feedback SHALL use a portal-scoped toast surface distinct from the internal toast host, and every failed mutation SHALL surface an actionable error.

#### Scenario: Bottom-sheet modal
- **WHEN** a modal is opened in the portal
- **THEN** it presents as a bottom sheet, not a centered desktop dialog

#### Scenario: Pull-to-refresh
- **WHEN** a tenant pulls down on the invoices or requests list
- **THEN** the list refreshes from its first page

#### Scenario: Profile mutation fails
- **WHEN** saving the tenant profile fails
- **THEN** the form remains open and displays the server error through the portal feedback surface

#### Scenario: Optimistic update rolls back on error
- **WHEN** a lightweight mutation fails
- **THEN** the optimistic UI change is rolled back and an error is surfaced

---

### Requirement: Distinct customer-facing identity
The tenant portal SHALL use a customer-facing visual identity distinct from the internal dark operational theme, and SHALL NOT introduce a new component library (it reuses Tailwind, shared `Ui*`/`Portal*` primitives, and `nuxt-svgo`). The identity SHALL be expressed as a named token system scoped to `.portal-shell` (color roles for canvas, surface, border, title, body, muted, primary/primary-soft, and positive/warning/danger status), so portal styling never leaks into the internal dark theme. The portal SHALL use a single confident primary accent and body-text color meeting WCAG AA contrast on portal surfaces, and SHALL NOT introduce a new web font (Inter only).

#### Scenario: Portal identity differs from internal theme
- **WHEN** a tenant views the portal
- **THEN** its palette, type, and spacing follow the portal identity rather than the internal dark operational theme

#### Scenario: Tokens are portal-scoped
- **WHEN** portal color and surface styling is applied
- **THEN** it resolves from tokens scoped to `.portal-shell` and does not alter the internal admin theme

#### Scenario: Body text meets contrast
- **WHEN** portal body text renders on a portal surface
- **THEN** its color meets WCAG AA contrast against that surface

---

### Requirement: Consistent portal type scale and spacing rhythm
The portal SHALL apply an explicit, reused type scale (display, heading, label, body, caption) and a consistent spacing rhythm, card padding, radius, and elevation across all portal pages and shared components, rather than per-page ad-hoc sizes. Cards SHALL use one standard padding and radius, controls one radius, and no more than two elevation levels.

#### Scenario: Headings follow the type scale
- **WHEN** a portal page renders titles, section headings, and captions
- **THEN** they use the shared type-scale roles rather than arbitrary per-page font sizes

#### Scenario: Consistent card and spacing treatment
- **WHEN** any two portal pages render content cards and sections
- **THEN** they share the same page rhythm, card padding, radius, and elevation

---

### Requirement: Money statement treatment as signature element
The portal SHALL present monetary amounts (invoice balances and totals) with a consistent statement treatment using tabular numerals and a currency unit rendered distinctly from the figure, and the amount SHALL be colored by payment status. The invoice statement surfaces (home overview, invoices list, invoice detail) SHALL carry a thin status-colored accent indicating paid, due, or overdue.

#### Scenario: Amounts use tabular numerals and unit styling
- **WHEN** a monetary amount is displayed in the portal
- **THEN** it uses tabular numerals with the currency unit styled distinctly from the figure

#### Scenario: Status accent reflects payment state
- **WHEN** an invoice statement surface renders
- **THEN** a status-colored accent indicates whether the invoice is paid, due, or overdue

---

### Requirement: Unified form control and status semantics
Portal text and multiline inputs SHALL use the shared `PortalInput` primitive rather than page-local raw inputs, and invoice and request status badges SHALL derive their color and label from a single status-to-style mapping so equivalent states read consistently (positive for paid/resolved, warning/accent for pending or partial, danger for overdue).

#### Scenario: Forms use the shared field primitive
- **WHEN** a tenant edits their profile or creates a support request
- **THEN** the form fields render through the shared `PortalInput` primitive with consistent focus and error styling

#### Scenario: Status badges are consistent
- **WHEN** invoice and request statuses are displayed
- **THEN** equivalent states use the same status-to-style mapping for color and semantics

---

### Requirement: Portal pages consume tenant APIs
The portal SHALL provide overview, paginated invoice list, invoice detail, room/contract, requests, and profile pages, each consuming only the archived `/api/tenant/**` endpoints and never internal endpoints. The invoice list SHALL allow loading all available pages without silently truncating history.

#### Scenario: Invoice pages use tenant API
- **WHEN** the invoices list or detail page loads
- **THEN** it fetches from `/api/tenant/invoices**` and shows only the caller's data

#### Scenario: More invoice history exists
- **WHEN** invoice metadata reports another page
- **THEN** the page shows an accessible load-more action and appends the next page

#### Scenario: Profile edit uses whitelist
- **WHEN** a tenant edits their profile
- **THEN** only whitelisted non-identity fields are submitted and legal identity controls are read-only

#### Scenario: Roommate role is explicit
- **WHEN** the active housing context has `assignmentRole = roommate`
- **THEN** the overview and room pages label the caller as “Người ở cùng” and show the primary tenant name without implying ownership of the contract

---

### Requirement: Complete tenant profile dossier and guarded editing
The portal SHALL present `/portal/profile` as the complete personal dossier for the authenticated tenant without duplicating room, building, contract, or occupancy information. Self-service editing SHALL use `/portal/profile/edit`, expose only whitelisted fields, submit only normalized changed values, and protect dirty values from accidental navigation.

#### Scenario: Complete personal dossier
- **WHEN** a tenant opens `/portal/profile`
- **THEN** the portal shows the safe own-profile DTO, read-only identity images, and tenant documents, with no internal-notes section
- **AND** missing optional values are identified as not yet updated
- **AND** room, building, contract, and occupancy details are not duplicated

#### Scenario: Dedicated self-service edit screen
- **WHEN** a tenant chooses `Chỉnh sửa`
- **THEN** the portal opens `/portal/profile/edit`
- **AND** only contact phone, occupation, emergency contact name and emergency contact phone are editable
- **AND** the update payload contains only normalized changed fields

#### Scenario: Tenant needs an identity correction
- **WHEN** a tenant needs to correct personal/legal data or an identity image
- **THEN** the dossier provides “Yêu cầu chỉnh sửa” through `/portal/requests?intent=profile-correction`
- **AND** identity values are never placed in route queries or localStorage
- **AND** canonical identity has no tenant upload/replace/delete controls

#### Scenario: Tenant opens password security
- **WHEN** a tenant chooses `Đổi mật khẩu` from `/portal/profile`
- **THEN** the portal opens `/portal/profile/password`
- **AND** requires current password, new password, and confirmation

#### Scenario: Unsaved profile changes
- **WHEN** a tenant attempts in-app navigation with unsaved profile changes
- **THEN** a portal bottom sheet offers to continue editing or discard the changes
- **AND** closing the sheet preserves the form

---

### Requirement: Read-only identity and personal documents bound to agreed storage
The portal document UI SHALL consume the archived storage convention and SHALL NOT invent paths or buckets. Canonical identity previews SHALL use `GET /api/tenant/id-images` against the shared private bucket; tenant POST/DELETE are forbidden. Proposed evidence uses a private support request attachment and never writes canonical slots. Free-form documents SHALL use `GET/POST /api/tenant/documents` and `DELETE /api/tenant/documents/[id]` against the `tenant-documents` bucket. The UI SHALL render only the server-returned short-lived signed URLs and SHALL rely on the server for path/bucket selection and mime/size validation.

#### Scenario: Evidence pending manual handling
- **WHEN** a tenant supplies evidence for an identity correction
- **THEN** the request keeps one private image/PDF up to 5 MB and explains that the profile has not changed
- **AND** absence of active housing context has actionable contact-management guidance, not a falsely routed request

#### Scenario: Free-form document upload
- **WHEN** a tenant uploads a document
- **THEN** the UI calls `POST /api/tenant/documents` and lists it via the returned signed URL

#### Scenario: Upload UX on flaky network
- **WHEN** a tenant uploads on a flaky mobile network
- **THEN** the UI shows progress, surfaces mime/size errors before upload, and offers an explicit retry after failure without silently repeating a non-idempotent POST

#### Scenario: Identity image retrieval fails
- **WHEN** the image endpoint fails or an ephemeral preview expires
- **THEN** the UI shows a retrieval/retry state instead of claiming that the tenant has no identity image

#### Scenario: Signed URLs are not persisted client-side
- **WHEN** the portal renders a signed URL for an identity image or document
- **THEN** the URL is treated as ephemeral and is not written to the service-worker cache

---

### Requirement: Tenant financial overview
The portal home SHALL summarize recent invoice activity from the invoices already loaded and explicitly label that scope. It SHALL exclude drafts and void invoices, group all loaded valid invoices in the same billing month into one bar, and show at most the six newest distinct months in chronological order. Average monthly value SHALL divide by displayed month count, not invoice count; paid ratio SHALL use those same displayed invoices and remain bounded from 0 to 100 percent. This chart SHALL NOT supply the complete outstanding-debt figure.

#### Scenario: Tenant has enough invoice history
- **WHEN** the loaded valid invoices cover at least two distinct months
- **THEN** the portal home displays up to the six newest loaded billing months in chronological order
- **AND** the chart displays each period’s total invoice value as one vertical bar
- **AND** the home displays average monthly invoice value and the paid ratio
- **AND** chart colors resolve from the active portal theme
- **AND** chart animation is disabled when the tenant prefers reduced motion

#### Scenario: Tenant has insufficient invoice history
- **WHEN** the loaded valid invoices cover fewer than two distinct months
- **THEN** the financial overview is not displayed

#### Scenario: Multiple invoices share a month
- **WHEN** two valid loaded invoices belong to the same billing month
- **THEN** their amounts are added into one monthly bar and that month counts once in the average

---

### Requirement: Action-first portal home
The portal home SHALL keep the active room as its primary identity surface, then show the server-owned complete-scope `financialSummary`: outstanding amount/count, overdue amount/count and the prioritized `nextInvoice` action. Overdue obligations SHALL precede other debt, with earlier known due dates first. Recent invoice history SHALL remain secondary, and the loaded-history chart SHALL be presented as one coherent region with its supporting metrics. A bootstrap failure SHALL replace content with an explicit retry state instead of being rendered as empty business data.

#### Scenario: An older obligation remains unpaid
- **WHEN** an older authorized invoice has payable debt, even beyond the loaded page or while the latest invoice is paid
- **THEN** the complete debt region still shows its amount and exposes the server-selected invoice action
- **AND** dates and any grace/overdue explanation use the stored schedule

#### Scenario: No payable obligation remains
- **WHEN** the server reports no outstanding invoices
- **THEN** the debt region shows that state and the latest invoice remains available as history

#### Scenario: Bootstrap fails
- **WHEN** the portal bootstrap request fails
- **THEN** the home shows a failure explanation and `Thử lại`
- **AND** it does not claim that the tenant has no contract or invoices

#### Scenario: Primary navigation already exposes a destination
- **WHEN** requests and profile are available in the portal navigation
- **THEN** the home does not add duplicate request or profile quick-action cards

---

### Requirement: Tenant invoice transfer instructions
The portal invoice detail SHALL present transfer instructions only from the immutable invoice payment-profile snapshot. Outstanding invoices SHALL make payment instructions prominent and copyable; paid invoices SHALL retain the snapshot as secondary read-only history; void invoices SHALL hide payment instructions. The UI SHALL never replace a missing historical snapshot with the current building profile.

#### Scenario: Outstanding invoice has a payment snapshot
- **WHEN** an issued, partial, or overdue invoice has a positive balance and a valid payment-profile snapshot
- **THEN** transfer instructions appear after the invoice summary and before charge details
- **AND** the tenant can copy the account number and rendered transfer content
- **AND** the remaining amount and available QR image are visible

#### Scenario: Transfer text is copied
- **WHEN** the tenant copies an account number or transfer content
- **THEN** the portal-scoped toast confirms which value was copied
- **AND** clipboard failure produces an actionable error message

#### Scenario: Paid invoice has a payment snapshot
- **WHEN** a paid invoice has a valid payment-profile snapshot
- **THEN** the snapshot appears after charge details as secondary historical information
- **AND** QR and copy controls are omitted to avoid prompting a duplicate transfer

#### Scenario: Voided invoice
- **WHEN** an invoice is void
- **THEN** transfer instructions are absent
- **AND** the stored void reason is shown when available

#### Scenario: Payment snapshot is unavailable
- **WHEN** an active invoice has no valid payment-profile snapshot
- **THEN** the portal directs the tenant to contact management
- **AND** current building payment data is not displayed as a replacement

#### Scenario: QR asset is unavailable
- **WHEN** a valid snapshot has bank text fields but its QR asset cannot be signed
- **THEN** the immutable text fields remain usable
- **AND** the portal shows `QR chưa khả dụng`

#### Scenario: Tenant wants a transfer checked
- **WHEN** a tenant follows the invoice's payment-report action
- **THEN** the portal opens `/portal/requests?intent=payment-report&invoice=<invoiceCode>` with neutral reconciliation copy
- **AND** it explains that sending evidence does not itself confirm payment or update the balance

---

### Requirement: Tenant invoice statement ledger
The portal invoice history SHALL present invoices as a year-grouped statement ledger sorted by billing period from newest to oldest regardless of tenant API return order. Invoice detail SHALL use a document-like hierarchy with one primary amount and a bounded, accessible payment-progress indicator. These presentation changes SHALL preserve the existing outstanding-payment, paid-history, and void-state ordering.

#### Scenario: Invoice history has multiple years
- **WHEN** the tenant invoice API returns invoices spanning multiple years
- **THEN** the portal sorts rows by `periodYear` descending and then `periodMonth` descending before grouping by year
- **AND** invoices in the same billing period retain their original relative order
- **AND** each row shows the billing month, invoice code, locally formatted due date when available, total and paid context, primary amount, and status
- **AND** the entire row exposes one navigation target to its invoice detail

#### Scenario: Invoice detail shows payment progress
- **WHEN** a tenant opens an invoice detail
- **THEN** the summary shows one primary amount
- **AND** payment progress is computed from paid amount divided by total amount and bounded from 0 to 100 percent
- **AND** the progress indicator exposes its current value to assistive technology

#### Scenario: Statement detail preserves payment-state ordering
- **WHEN** an outstanding, paid, or void invoice detail renders
- **THEN** outstanding transfer instructions remain before charge details
- **AND** paid payment history remains after charge details
- **AND** void invoices do not render transfer instructions

#### Scenario: Recorded payment history is available
- **WHEN** invoice detail includes recorded payments
- **THEN** the portal shows date, amount and a user-facing method/source label, distinguishing deposit or credit allocations from cash payments
- **AND** no tenant control records, changes or deletes a payment

#### Scenario: Utility charge includes issued meter evidence
- **WHEN** an electricity or water charge contains a usable reading snapshot
- **THEN** the portal shows available opening/closing readings and billable usage with units, identifies adjusted usage, and leaves missing values unavailable
- **AND** current meter readings are not presented as historical evidence

### Requirement: Primary contract files and complete support detail
The room page SHALL expose issued/signed official documents only for the current primary tenant. Roommates SHALL retain the shared terms summary without full legal-document controls. The request timeline SHALL support pagination and full detail with description, current public staff reply and response time, attachment availability and a detail refresh action. Request drafts SHALL stay in memory, preserve input after failure and warn before unsaved navigation.

#### Scenario: Primary tenant opens an official document
- **WHEN** a current primary tenant chooses an available official document
- **THEN** the portal requests a newly authorized short-lived download URL and reports failure without substituting another contract's file

#### Scenario: Full request has an expired attachment link
- **WHEN** the tenant opens or refreshes a request
- **THEN** detail is fetched through the self-scoped endpoint and can renew attachment access while preserving the text if signing is unavailable

### Requirement: Session-isolated private state
Portal async-data keys SHALL include the authenticated account identity. Account changes and logout SHALL clear portal private data; pagination, mutation generations, pending upload progress and local drafts SHALL not cross accounts. Responses from invalidated work SHALL not mutate the next account's state or trigger a stale success. Explicit refresh SHALL reset paginated history and invalidate older operations where applicable. Signed URLs and private drafts SHALL not be persisted in browser storage or service-worker caches.

#### Scenario: Account switches while a response is pending
- **WHEN** tenant A starts a profile save, upload, delete or list read and the active account changes to B
- **THEN** late A data/errors/progress do not overwrite B's state and cannot produce A's successful result in B's flow

#### Scenario: Same account returns after another session
- **WHEN** the actor changes A→B→A while A's original work is still pending
- **THEN** the original operation remains invalidated rather than becoming current solely because the account ID matches again

### Requirement: Tenant invoice grace explanation
Tenant invoice detail and latest-outstanding surfaces SHALL display the invoice due date as the payment obligation date and SHALL explain an active grace interval without introducing a new invoice status.

#### Scenario: Invoice is within grace
- **WHEN** today is after `dueDate`, on or before `overdueDate`, and the invoice has a positive balance
- **THEN** the portal displays “Đang trong thời gian gia hạn đến …” using the Vietnamese-formatted overdue date

#### Scenario: Grace has ended
- **WHEN** today is after `overdueDate`
- **THEN** the portal uses the existing overdue status treatment and does not describe the invoice as still in grace

#### Scenario: Legacy due date is missing
- **WHEN** an invoice has no due date
- **THEN** detail surfaces display “Chưa có hạn thanh toán” instead of a synthetic four-day fallback

Restricted edit and staff-intake implementation: [change record](../history/2026-11-10-restrict-tenant-portal-profile-edits/index.md). No historical identity image is retroactively labelled verified.
