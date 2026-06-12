## ADDED Requirements

### Requirement: Period unissue endpoint
A `POST /api/billing/periods/:id/unissue` endpoint SHALL revert the issue step for a period while preserving invoices that already received any payment.

#### Scenario: Unissue succeeds and voids unpaid invoices
- **WHEN** an authorized actor calls unissue on a period with status `issued` or `collecting`, all invoices have zero successful payments, and `reason` is at least 10 characters after trim
- **THEN** every invoice is voided via the existing void path, the period status returns to `drafted`, an audit event `period.unissued` is appended with metadata `{ reason, voided_count, retained_paid_count: 0, retained_invoice_ids: [] }`, and the response returns `{ voided, retained: 0, status: "drafted" }`

#### Scenario: Unissue retains paid invoices
- **WHEN** unissue is called and one or more invoices have at least one successful payment
- **THEN** unpaid invoices are voided, paid invoices are retained unchanged, the period status remains `collecting`, the audit metadata includes `retained_paid_count` and `retained_invoice_ids`, and the response returns the counts and `status: "collecting"`

#### Scenario: Unissue blocked when period closed
- **WHEN** unissue is called on a period with status `closed`
- **THEN** the request fails with `409 CONFLICT` and an error message indicating the period is closed and cannot be unissued

#### Scenario: Reason length enforced
- **WHEN** unissue is called with `reason` shorter than 10 characters after trim
- **THEN** the request fails with `400 VALIDATION_ERROR` and a message indicating the minimum reason length

#### Scenario: Permission required
- **WHEN** the caller lacks the `billing.unissue` capability
- **THEN** the request fails with `403 FORBIDDEN`

### Requirement: New permission `billing.unissue`
The permission system SHALL define a `billing.unissue` capability granted only to admins by default.

#### Scenario: Admin has unissue capability
- **WHEN** an admin user is checked for `billing.unissue`
- **THEN** the check returns true

#### Scenario: Manager lacks unissue capability by default
- **WHEN** a manager user without explicit grant is checked for `billing.unissue`
- **THEN** the check returns false even if they hold `billing.write` and `billing.close`

#### Scenario: Capability separate from write and close
- **WHEN** access policy is reviewed
- **THEN** `billing.unissue` is documented as a distinct capability and is required in addition to (not replaced by) `billing.write` and `billing.close`

### Requirement: Unissue UI confirmation
The workspace SHALL surface unissue as an admin-only kebab action with a preview-and-confirm modal.

#### Scenario: Kebab item visibility
- **WHEN** an admin opens the workspace header kebab menu
- **THEN** a "Hủy phát hành kỳ" item is visible; for non-admins it is hidden or shown disabled with a permission tooltip

#### Scenario: Confirmation modal preview
- **WHEN** the admin opens the unissue modal
- **THEN** the modal previews the number of invoices that will be voided and the number that will be retained because they have payments

#### Scenario: Reason capture in modal
- **WHEN** the unissue modal is open
- **THEN** a textarea captures the reason with a live character counter; the submit action is disabled until trimmed length reaches 10

#### Scenario: Modal blocked when period closed
- **WHEN** the period status is `closed`
- **THEN** the kebab item is disabled with a tooltip explaining that closed periods cannot be unissued
