## ADDED Requirements

### Requirement: Reopen requires reason
The reopen flow that returns a `closed` period to an editable state SHALL require a textual reason of at least 10 characters, consistent with the unissue flow's reason policy.

#### Scenario: Reopen with valid reason
- **WHEN** an authorized actor calls the reopen endpoint on a `closed` period with `reason` of at least 10 characters after trim
- **THEN** the period status returns to `collecting` (or its prior pre-close status), and an audit event `period.reopened` is appended with metadata `{ reason, prior_status, trigger: 'manual' }`

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
- **THEN** the resulting `period.status_changed` (or equivalent) audit metadata includes `trigger: 'auto_from_issue'`

#### Scenario: Auto status change from payment
- **WHEN** recording the first payment auto-transitions the period from `issued` to `collecting`
- **THEN** the resulting status-change audit metadata includes `trigger: 'auto_from_payment'`
