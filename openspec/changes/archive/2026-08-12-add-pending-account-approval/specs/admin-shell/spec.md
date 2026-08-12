## MODIFIED Requirements

### Requirement: Auth layout dành riêng cho trang login
App SHALL use `layouts/auth.vue` for login, registration, forgot-password, reset-password, callback, and pending status. The layout SHALL have no application sidebar/header, SHALL use the Zeno House dark/cyan/Inter system, SHALL render a two-panel brand/form composition on desktop, and SHALL collapse the illustration to a compact top band on mobile.

#### Scenario: Auth page uses split layout on desktop
- **WHEN** viewport is at least the desktop breakpoint and an auth route renders
- **THEN** the operational illustration and form occupy separate readable panels without application chrome

#### Scenario: Auth page is usable on mobile
- **WHEN** viewport is 320, 375, 414, or 768 pixels wide
- **THEN** the illustration becomes a compact top band and the form has no horizontal overflow

## ADDED Requirements

### Requirement: Admin shell exposes pending access review
App SHALL add an admin-only navigation item and `/dashboard/settings/access-requests` page. The page SHALL show loading, empty, error, pending, approved, and rejected states and SHALL use shared table, modal, input, select/combobox, checkbox, alert, and button primitives.

#### Scenario: Admin sees review queue
- **WHEN** admin opens the access-request settings route
- **THEN** pending requests and decision controls are available

#### Scenario: Owner cannot see review queue
- **WHEN** owner renders navigation or opens the route
- **THEN** the item is hidden and the route redirects to `/dashboard`

#### Scenario: Approval form changes by role
- **WHEN** admin selects owner/manager or tenant in the approval modal
- **THEN** the form requires building selection or tenant selection respectively and prevents submit until valid
