## Purpose

Defines the period unissue capability for reverting an issued billing period while preserving invoices that already have payments.

## Requirements

### Requirement: Period unissue endpoint
A `POST /api/billing/periods/:id/unissue` endpoint SHALL revert the issue step for a period while preserving invoices that already received any payment.

#### Scenario: Unissue succeeds and voids unpaid invoices
- **WHEN** an authorized actor calls unissue on a period with status `issued` or `collecting`, all invoices have zero successful payments, and `reason` is at least 10 characters after trim
- **THEN** every invoice is voided via the existing void path, the period status returns to `draft`, an audit event `period.unissued` is appended with metadata `{ reason, voided_count, retained_paid_count: 0, retained_invoice_ids: [] }`, and the response returns `{ voided, retained: 0, status: "draft" }`

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
- **THEN** a `Huỷ phát hành kỳ` item is visible; for non-admins it is hidden or shown disabled with a permission tooltip

#### Scenario: Confirmation modal preview
- **WHEN** the admin opens the unissue modal
- **THEN** the modal previews the number of invoices that will be voided and the number that will be retained because they have payments

#### Scenario: Reason capture in modal
- **WHEN** the unissue modal is open
- **THEN** a textarea captures the reason with a live character counter; the submit action is disabled until trimmed length reaches 10

#### Scenario: Modal blocked when period closed
- **WHEN** the period status is `closed`
- **THEN** the kebab item is disabled with a tooltip explaining that closed periods cannot be unissued

### Requirement: Reopen requires reason
The reopen flow that returns a `closed` period to an editable state SHALL require a textual reason of at least 10 characters, consistent with the unissue flow's reason policy.

#### Scenario: Reopen with valid reason
- **WHEN** an authorized actor calls the reopen endpoint on a `closed` period with `reason` of at least 10 characters after trim
- **THEN** the period status returns to `collecting` or its prior pre-close status, and an audit event `period.reopened` is appended with metadata `{ reason, prior_status, trigger: 'manual' }`

#### Scenario: Reopen with short reason rejected
- **WHEN** reopen is called with `reason` shorter than 10 characters after trim
- **THEN** the request fails with `400 VALIDATION_ERROR` and a message indicating the minimum reason length

#### Scenario: Reopen unauthorized
- **WHEN** the caller lacks reopen permission
- **THEN** the request fails with `403 FORBIDDEN`

#### Scenario: Reopen on already-open period
- **WHEN** the period status is not `closed`
- **THEN** the request fails with `409 CONFLICT` and code `NOT_CLOSED`

### Requirement: Status-change audit carries trigger
The period status-change audit events SHALL include a `trigger` field in metadata identifying whether the change was manually initiated or cascaded from another operation.

#### Scenario: Manual status change
- **WHEN** a user explicitly opens, closes, reopens, or unissues a period
- **THEN** the audit metadata includes `trigger: 'manual'`

#### Scenario: Auto status change from issue
- **WHEN** issuing the first invoice in a period auto-transitions the period from `draft` to `issued`
- **THEN** the resulting status-change audit metadata includes `trigger: 'auto_from_issue'`

#### Scenario: Auto status change from payment
- **WHEN** recording the first payment auto-transitions the period from `issued` to `collecting`
- **THEN** the resulting status-change audit metadata includes `trigger: 'auto_from_payment'`
