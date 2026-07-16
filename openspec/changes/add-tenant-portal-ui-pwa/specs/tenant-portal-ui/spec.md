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

### Requirement: Portal pages consume tenant APIs
The portal SHALL provide overview, invoices list, invoice detail, room/contract, requests, and profile pages, each consuming only `/api/tenant/**` endpoints and never internal endpoints.

#### Scenario: Invoice pages use tenant API
- **WHEN** the invoices list or detail page loads
- **THEN** it fetches from `/api/tenant/invoices**` and shows only the caller's data

#### Scenario: Profile edit uses whitelist
- **WHEN** a tenant edits their profile
- **THEN** only whitelisted contact fields are submitted, validated by the shared schema

#### Scenario: Document upload UX
- **WHEN** a tenant uploads a document on a flaky mobile network
- **THEN** the UI shows progress, allows retry, and surfaces mime/size errors before upload
