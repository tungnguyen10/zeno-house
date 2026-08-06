## MODIFIED Requirements

### Requirement: Tenant invoice list and detail
Tenant invoice list and detail endpoints SHALL preserve existing tenant and roommate scope rules and SHALL return immutable `dueDate`, `gracePeriodDays`, and `overdueDate` schedule fields. Derived overdue status SHALL use `overdueDate`, not `dueDate`.

#### Scenario: Grace interval is not overdue
- **WHEN** an unpaid issued invoice is past `dueDate` but not past `overdueDate`
- **THEN** the API keeps its derived status issued and returns both dates

#### Scenario: Invoice is overdue after grace
- **WHEN** an unpaid issued invoice is past `overdueDate`
- **THEN** the API marks it overdue

#### Scenario: Legacy invoice has no due date
- **WHEN** an owned legacy invoice has null due and overdue dates
- **THEN** the API returns both as null without inventing a fallback

#### Scenario: Existing scope and immutable payment instructions remain
- **WHEN** a tenant or active roommate requests an invoice within their resolved scope
- **THEN** the API returns only authorized invoice data and the stored payment-profile snapshot without substituting current building data
