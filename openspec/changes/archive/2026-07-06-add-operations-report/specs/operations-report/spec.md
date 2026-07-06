## ADDED Requirements

### Requirement: Monthly operations report
The system SHALL provide a building/month operations report that combines billing revenue with building operating costs.

#### Scenario: Report returns monthly metrics
- **WHEN** an authorized user requests `GET /api/operations-report` with `building_id`, `period_year`, and `period_month`
- **THEN** the API returns issued revenue, collected amount, outstanding debt, fixed cost total, monthly expense total, total expense, profit by revenue, and profit by cash for that building/month

#### Scenario: Report uses issued billing snapshots
- **WHEN** billing source data such as contracts, service prices, or meter readings changes after invoices are issued
- **THEN** the operations report revenue remains based on non-void `invoices` and `invoice_charges` snapshots

#### Scenario: Voided invoices excluded
- **WHEN** an invoice for the selected building/month has status `void`
- **THEN** its totals, charges, and payments are excluded from operations report revenue and collection totals

#### Scenario: Soft-deleted payments excluded
- **WHEN** an invoice payment has `deleted_at` set
- **THEN** the payment amount is excluded from collected amount

### Requirement: Revenue breakdown
The system SHALL break down issued revenue by invoice charge type for the selected building/month.

#### Scenario: Charge type totals returned
- **WHEN** the report is generated
- **THEN** it includes totals for charge types `rent`, `electricity`, `water`, `service`, `discount`, `surcharge`, `adjustment`, and `other` when present

#### Scenario: Discount visible separately
- **WHEN** discount charges exist for the selected building/month
- **THEN** the report returns discount as a distinct breakdown value so the UI can display it separately from positive revenue groups

### Requirement: Expense records
The system SHALL store monthly building expenses as building-scoped financial records.

#### Scenario: Create expense
- **WHEN** an authorized user submits a valid expense with building, period, category, amount, date, and optional payee/payment method/note
- **THEN** the system creates a `building_expenses` row with `created_by` and returns it

#### Scenario: Update expense
- **WHEN** an authorized user updates a non-void expense within their building scope
- **THEN** the system persists the allowed changes and updates `updated_at`

#### Scenario: Void expense
- **WHEN** an authorized user deletes an expense
- **THEN** the system sets `voided_at`, `voided_by`, and `void_reason` instead of hard-deleting the row

#### Scenario: Voided expense excluded from totals
- **WHEN** an expense has `voided_at` set
- **THEN** it is excluded from report expense totals and the active expense list

### Requirement: Fixed costs
The system SHALL store recurring building fixed costs with period-based effective ranges.

#### Scenario: Create rent fixed cost
- **WHEN** an authorized user creates a fixed cost with category `rent`, amount, building, and effective-from period
- **THEN** the system stores it and includes it in reports for periods where the effective range applies

#### Scenario: Historical fixed cost preserved
- **WHEN** a later fixed cost amount is added for a newer effective period
- **THEN** earlier reports continue using the earlier applicable fixed cost amount

#### Scenario: End fixed cost
- **WHEN** an authorized user ends a fixed cost at an effective-to period
- **THEN** reports after that end period no longer include that row

#### Scenario: Overlapping fixed costs rejected
- **WHEN** a user attempts to create or update a fixed cost whose category and effective range overlaps an existing active fixed cost for the same building
- **THEN** the system rejects the request with a conflict error

### Requirement: Expense breakdown and utility margin
The system SHALL present expense breakdowns and input/output utility margins for the selected building/month.

#### Scenario: Expense category totals returned
- **WHEN** the report is generated
- **THEN** it includes fixed-cost and monthly-expense totals grouped by category

#### Scenario: Electricity margin returned
- **WHEN** invoice charges include `electricity` and expenses include `electricity_input`
- **THEN** the report returns electricity collected from tenants, electricity input cost, and the difference

#### Scenario: Water margin returned
- **WHEN** invoice charges include `water` and expenses include `water_input`
- **THEN** the report returns water collected from tenants, water input cost, and the difference

### Requirement: Operations permissions and scope
The system SHALL enforce operations-report capabilities and building scope in the service layer.

#### Scenario: Report read requires capability
- **WHEN** a user without `operations-report.read` calls the report API
- **THEN** the API returns 403 FORBIDDEN

#### Scenario: Scoped report read
- **WHEN** an owner or manager requests a report for a building outside their assigned scope
- **THEN** the API returns 404 NOT_FOUND

#### Scenario: Expense write requires capability and scope
- **WHEN** a user without `building-expenses.write` or outside the target building scope creates or updates an expense
- **THEN** the API returns 403 FORBIDDEN

#### Scenario: Expense delete requires delete capability
- **WHEN** a user without `building-expenses.delete` attempts to void an expense
- **THEN** the API returns 403 FORBIDDEN

#### Scenario: Fixed-cost write requires capability
- **WHEN** a user without `building-fixed-costs.write` attempts to create, update, or end a fixed cost
- **THEN** the API returns 403 FORBIDDEN

### Requirement: Operations report UI
The system SHALL provide an authenticated `/operations-report` page for building/month operations reporting.

#### Scenario: Filter report
- **WHEN** a user opens `/operations-report`
- **THEN** the page allows selecting building, month, year, and expense category filters subject to the user's building scope

#### Scenario: Display report sections
- **WHEN** report data is loaded
- **THEN** the page displays metric cards, revenue breakdown, expense breakdown, utility margin, and active expense rows

#### Scenario: Manage expenses from report
- **WHEN** a user has expense write permission
- **THEN** the page exposes controls to add and edit expense rows for buildings within scope

#### Scenario: Hide unauthorized actions
- **WHEN** a user lacks expense delete or fixed-cost write capabilities
- **THEN** the page does not render the corresponding destructive or fixed-cost configuration actions
