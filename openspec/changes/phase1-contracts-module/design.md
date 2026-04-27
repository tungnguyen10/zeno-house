## Context

Contracts link tenants to rooms with a defined period and rent amount. The template system uses `{{placeholder}}` syntax (Mustache-like). When a contract is created from a template, the rendered HTML is stored as `content_html` on the contract row — this is the legal snapshot, independent of future template changes.

> **Schema notes:** The `contracts` table already exists (migration 001) with fields: `id`, `room_id`, `tenant_id`, `template_id`, `start_date`, `end_date`, `monthly_rent`, `deposit_paid`, `payment_day`, `status`, `notes`, `created_at`, `updated_at`. The following fields do NOT exist yet and require migration 003: `content_html TEXT`, `previous_contract_id UUID REFERENCES contracts(id)`, `terminated_reason TEXT`. The `contract_templates` table stores template body as `content` (NOT `content_html`). Status enum additions (`pending_signature`, `renewed`) also require migration 003.

## Goals / Non-Goals

**Goals:**

- Contract lifecycle (migration 001): `pending → active → expired/terminated`. Migration 003 adds `pending_signature` + `renewed`. The `draft` status does NOT exist — do not add it
- Template editor with live preview using real tenant/room data
- Expiry warnings at 7/30/60 days
- Renew flow creates a new contract linked to the old one
- PDF export button as disabled placeholder (tooltip: "Sắp có")

**Non-Goals:**
- E-signature integration (Phase 2)
- PDF generation (Phase 2)
- Digital stamp/watermark (Phase 2)
- Multi-tenant contracts (one tenant per contract)

## Decisions

### 1. Template placeholders use `{{key}}` syntax, rendered server-side

`generateFromTemplate(templateId, data)` calls `POST /api/contracts` with `template_id`. The server fetches the template, replaces placeholders with real data, and stores `content_html`.

**Why**: Server-side render prevents client-side injection; the stored snapshot is always the final rendered version.

### 2. Available placeholders are defined as a fixed set

Supported: `{{tenant_name}}`, `{{tenant_phone}}`, `{{tenant_identity_number}}`, `{{room_number}}`, `{{building_name}}`, `{{monthly_rent}}`, `{{start_date}}`, `{{end_date}}`, `{{deposit_paid}}`.

**Why**: Fixed set is easy to document and validate; extensible in Phase 2.

### 3. Renew creates a NEW contract record (not update)

`renewContract(id)` creates a new contract with `start_date = old.end_date + 1 day`, `previous_contract_id = old.id`, and sets old contract to `renewed`.

**Why**: Preserves full audit trail; each contract period is a distinct record.

### 4. Expiry warnings are computed client-side from `contracts.end_date`

`getExpiringContracts(days)` is a composable method that filters loaded contracts by `end_date` within the next N days.

**Why**: No cron job needed at this phase; computed on page load.

### 5. `ContractTemplateEditor` uses a plain `<textarea>` with syntax highlighting hint

No rich-text editor — templates are HTML strings. A `<pre>` preview pane updates on input.

**Why**: Simplest approach; rich editors add complexity and are Phase 2 if needed.

## Risks / Trade-offs

- **Room status sync** → Creating an active contract must set `rooms.status = 'occupied'`. Handled in `POST /api/contracts` handler. Terminating must set back to `available`. Mitigation: both done in same DB transaction.
- **Template XSS** → `content_html` is admin-generated and rendered as HTML in the preview. Mitigation: only render in a sandboxed iframe or with DOMPurify; never `v-html` without sanitization.

## Open Questions

- Should `pending_signature` be skippable? (i.e., can admin directly set `active`?) → Yes, for manual/offline signature workflows.
