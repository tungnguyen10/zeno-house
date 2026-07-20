## ADDED Requirements

### Requirement: Invoice payment-profile snapshot
Every invoice creation transaction SHALL persist the building invoice profile current at issuance as an immutable schema-versioned snapshot, or `NULL` when no profile exists.

#### Scenario: Period issuance snapshots profile
- **WHEN** one or more drafts are issued through period issuance
- **THEN** each created invoice receives bank data, rendered transfer content, asset paths, and snapshot time from the current building profile

#### Scenario: Issue-and-pay snapshots profile
- **WHEN** a ready draft is issued and paid atomically
- **THEN** the paid invoice receives the same profile snapshot semantics

#### Scenario: Reissue uses current profile
- **WHEN** a void invoice is reissued after the building profile changed
- **THEN** the replacement invoice snapshots the profile current at reissue time without modifying the void invoice

#### Scenario: Profile is absent
- **WHEN** an invoice is issued for a building without a profile
- **THEN** issuance succeeds and the invoice profile snapshot is `NULL`
