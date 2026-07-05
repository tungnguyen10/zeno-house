## Purpose

Define building-scoped recurring expense templates and reminder actions.

## Requirements

### Requirement: Recurring expense templates
The system SHALL store building-scoped recurring expense templates with a simple frequency and estimated amount.

#### Scenario: Create a recurring template
- **WHEN** an authorized in-scope user creates a recurring expense with name, category, frequency (`monthly`, `quarterly`, `biannual`, or `yearly`), anchor day (1-28), and estimated amount
- **THEN** the system stores the template with `created_by` and a computed `next_reminder_at`

#### Scenario: Update estimated amount
- **WHEN** an authorized user changes a template's estimated amount
- **THEN** future reminders use the new estimate and previously recorded expenses are unchanged

#### Scenario: Configuration requires write capability
- **WHEN** a user without `recurring-expenses.write` attempts to create, edit, or delete a template
- **THEN** the system responds with a forbidden error

#### Scenario: Templates limited to assigned buildings
- **WHEN** a non-admin user manages a template for a building outside their assignment scope
- **THEN** the system responds with a forbidden error

### Requirement: Recurring reminders
The system SHALL surface due and upcoming recurring items and let authorized users act on them.

#### Scenario: Upcoming reminder listed
- **WHEN** a template's `next_reminder_at` is on or before today plus seven days
- **THEN** the system lists it as a due/upcoming reminder for its building

#### Scenario: Record a reminder as an expense
- **WHEN** an authorized in-scope user records a due reminder and submits the prefilled expense
- **THEN** the system creates a normal building expense for the selected period and advances the template's `next_reminder_at` by one frequency step

#### Scenario: Dismiss a reminder
- **WHEN** an authorized in-scope user dismisses a due reminder
- **THEN** the system advances `next_reminder_at` by one frequency step without creating an expense

#### Scenario: Manager may record reminders
- **WHEN** a manager with `recurring-expenses.read` and `building-expenses.write` views a due reminder in scope
- **THEN** they can record it as an expense even though they cannot configure templates
