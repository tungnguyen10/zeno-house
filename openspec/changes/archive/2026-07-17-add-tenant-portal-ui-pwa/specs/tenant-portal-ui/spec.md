## ADDED Requirements

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
The tenant portal SHALL present a native-like app shell rather than a scrolling web page. It SHALL set `viewport-fit=cover` and apply `env(safe-area-inset-*)` padding so a fixed bottom tab bar and a sticky header respect the device notch and home indicator. Primary navigation SHALL be a fixed bottom tab bar with touch targets of at least 44px and an active indicator. Content SHALL be the only scrolling region, and route changes SHALL use page transitions that respect `prefers-reduced-motion`.

#### Scenario: Safe areas respected
- **WHEN** the portal renders on a device with a notch or home indicator
- **THEN** the header and bottom tab bar are padded by the safe-area insets and no control is obscured

#### Scenario: Bottom tab navigation
- **WHEN** a tenant navigates the portal
- **THEN** a fixed bottom tab bar provides primary navigation with ≥44px targets and an active indicator, and no desktop sidebar is shown

#### Scenario: Reduced motion respected
- **WHEN** the user prefers reduced motion
- **THEN** route transitions are minimized or disabled

---

### Requirement: Touch-first interactions
The portal SHALL use touch-first interaction patterns: modals SHALL be bottom sheets rather than centered desktop dialogs; lists SHALL use skeleton loaders instead of spinners and SHALL support pull-to-refresh on the invoices and requests lists; lightweight mutations SHALL use optimistic UI with rollback on error; and no action SHALL depend on hover. Portal feedback SHALL use a portal-scoped toast surface distinct from the internal toast host.

#### Scenario: Bottom-sheet modal
- **WHEN** a modal is opened in the portal
- **THEN** it presents as a bottom sheet, not a centered desktop dialog

#### Scenario: Pull-to-refresh
- **WHEN** a tenant pulls down on the invoices or requests list
- **THEN** the list refreshes

#### Scenario: Optimistic update rolls back on error
- **WHEN** a lightweight mutation fails
- **THEN** the optimistic UI change is rolled back and an error is surfaced

---

### Requirement: Distinct customer-facing identity
The tenant portal SHALL use a customer-facing visual identity distinct from the internal dark operational theme, and SHALL NOT introduce a new component library (it reuses Tailwind, shared `Ui*` primitives, and `nuxt-svgo`).

#### Scenario: Portal identity differs from internal theme
- **WHEN** a tenant views the portal
- **THEN** its palette, type, and spacing follow the portal identity rather than the internal dark operational theme

---

### Requirement: Portal pages consume tenant APIs
The portal SHALL provide overview, invoices list, invoice detail, room/contract, requests, and profile pages, each consuming only the archived `/api/tenant/**` endpoints and never internal endpoints.

#### Scenario: Invoice pages use tenant API
- **WHEN** the invoices list or detail page loads
- **THEN** it fetches from `/api/tenant/invoices**` and shows only the caller's data

#### Scenario: Profile edit uses whitelist
- **WHEN** a tenant edits their profile
- **THEN** only whitelisted contact fields are submitted, validated by the shared schema

---

### Requirement: Identity and document upload bound to agreed storage
The portal document UI SHALL consume the archived storage convention and SHALL NOT invent paths or buckets. Identity front/back images SHALL use `GET /api/tenant/id-images`, `POST /api/tenant/id-images/[side]`, and `DELETE /api/tenant/id-images/[side]` against the shared `tenant-id-images` bucket. Free-form documents SHALL use `GET/POST /api/tenant/documents` and `DELETE /api/tenant/documents/[id]` against the `tenant-documents` bucket. The UI SHALL render only the server-returned short-lived signed URLs and SHALL rely on the server for path/bucket selection and mime/size validation.

#### Scenario: Identity slots use the shared bucket endpoints
- **WHEN** a tenant captures or replaces the front or back identity image
- **THEN** the UI calls `POST /api/tenant/id-images/[side]` and displays the returned signed URL, never constructing a storage path itself

#### Scenario: Free-form document upload
- **WHEN** a tenant uploads a document
- **THEN** the UI calls `POST /api/tenant/documents` and lists it via the returned signed URL

#### Scenario: Upload UX on flaky network
- **WHEN** a tenant uploads on a flaky mobile network
- **THEN** the UI shows progress, allows retry, and surfaces mime/size errors before upload

#### Scenario: Signed URLs are not persisted client-side
- **WHEN** the portal renders a signed URL for an identity image or document
- **THEN** the URL is treated as ephemeral and is not written to the service-worker cache
