## ADDED Requirements

### Requirement: Contract amendment management surface
Contract detail SHALL provide an amendment section that lists draft, scheduled, applied, and cancelled amendments and allows users with `contracts.update` to create/edit/delete drafts, publish valid drafts, and cancel scheduled amendments.

#### Scenario: Read-only manager views amendments
- **WHEN** a manager opens contract detail
- **THEN** amendment history is visible but mutation controls are absent

#### Scenario: Owner publishes a draft
- **WHEN** an in-scope owner confirms publication of a valid draft
- **THEN** the list refreshes and displays the resulting scheduled or applied state with effective date and term diff
