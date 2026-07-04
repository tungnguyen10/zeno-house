## ADDED Requirements

### Requirement: Expense receipt upload
The system SHALL let authorized users attach a receipt image to a building expense.

#### Scenario: Upload a receipt
- **WHEN** an authorized in-scope user uploads a jpeg, png, or webp image no larger than 5MB to `POST /api/building-expenses/[id]/receipt`
- **THEN** the system stores the object in the private `expense-receipts` bucket under a building-scoped path and sets the expense `receipt_url` to the stored object path

#### Scenario: Reject invalid receipt
- **WHEN** a user uploads a file that is not an allowed image type or exceeds the size limit
- **THEN** the system rejects the request with a validation error and does not modify the expense

#### Scenario: Upload requires write capability
- **WHEN** a user without `building-expenses.write` attempts to upload a receipt
- **THEN** the system responds with a forbidden error

#### Scenario: Upload limited to assigned buildings
- **WHEN** a non-admin user uploads a receipt for an expense in a building outside their assignment scope
- **THEN** the system responds with a forbidden error

### Requirement: Expense receipt retrieval
The system SHALL return receipts only as short-lived signed URLs to in-scope users.

#### Scenario: Signed URL returned
- **WHEN** an authorized in-scope user views an expense that has a receipt
- **THEN** the system returns a short-lived signed URL rather than a public URL

#### Scenario: No public exposure
- **WHEN** any client requests a receipt object
- **THEN** the object is not accessible without a valid signed URL scoped to that object

### Requirement: Expense receipt removal
The system SHALL let authorized users remove a receipt from an expense.

#### Scenario: Remove a receipt
- **WHEN** an authorized in-scope user calls `DELETE /api/building-expenses/[id]/receipt`
- **THEN** the system deletes the stored object and clears the expense `receipt_url`
