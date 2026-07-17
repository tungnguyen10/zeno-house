## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Consistent portal type scale and spacing rhythm
The portal SHALL apply an explicit, reused type scale (display, heading, label, body, caption) and a consistent spacing rhythm, card padding, radius, and elevation across all portal pages and shared components, rather than per-page ad-hoc sizes. Cards SHALL use one standard padding and radius, controls one radius, and no more than two elevation levels.

#### Scenario: Headings follow the type scale
- **WHEN** a portal page renders titles, section headings, and captions
- **THEN** they use the shared type-scale roles rather than arbitrary per-page font sizes

#### Scenario: Consistent card and spacing treatment
- **WHEN** any two portal pages render content cards and sections
- **THEN** they share the same page rhythm, card padding, radius, and elevation

### Requirement: Money statement treatment as signature element
The portal SHALL present monetary amounts (invoice balances and totals) with a consistent statement treatment using tabular numerals and a currency unit rendered distinctly from the figure, and the amount SHALL be colored by payment status. The invoice statement surfaces (home overview, invoices list, invoice detail) SHALL carry a thin status-colored accent indicating paid, due, or overdue.

#### Scenario: Amounts use tabular numerals and unit styling
- **WHEN** a monetary amount is displayed in the portal
- **THEN** it uses tabular numerals with the currency unit styled distinctly from the figure

#### Scenario: Status accent reflects payment state
- **WHEN** an invoice statement surface renders
- **THEN** a status-colored accent indicates whether the invoice is paid, due, or overdue

### Requirement: Unified form control and status semantics
Portal text and multiline inputs SHALL use the shared `PortalTextField` primitive rather than page-local raw inputs, and invoice and request status badges SHALL derive their color and label from a single status-to-style mapping so equivalent states read consistently (positive for paid/resolved, warning/accent for pending or partial, danger for overdue).

#### Scenario: Forms use the shared field primitive
- **WHEN** a tenant edits their profile or creates a support request
- **THEN** the form fields render through the shared `PortalTextField` primitive with consistent focus and error styling

#### Scenario: Status badges are consistent
- **WHEN** invoice and request statuses are displayed
- **THEN** equivalent states use the same status-to-style mapping for color and semantics
