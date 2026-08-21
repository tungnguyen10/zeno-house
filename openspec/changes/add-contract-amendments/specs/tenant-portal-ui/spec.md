## ADDED Requirements

### Requirement: Portal current terms and amendments
The room page SHALL label the current commercial snapshot as “Điều khoản hiện tại”, explain inherited payment due days accurately, omit internal notes, and show scheduled/applied amendment history only to the primary tenant.

#### Scenario: Primary tenant views published amendment
- **WHEN** the room payload includes a scheduled or applied amendment
- **THEN** the page shows its sequence, title, effective date, status, public content, and changed-term diff

#### Scenario: Roommate views room
- **WHEN** the assignment role is roommate
- **THEN** the page shows effective current terms without amendment documents or history

#### Scenario: No public amendment exists
- **WHEN** the primary tenant has no scheduled or applied amendment
- **THEN** the page does not render an empty amendment section
