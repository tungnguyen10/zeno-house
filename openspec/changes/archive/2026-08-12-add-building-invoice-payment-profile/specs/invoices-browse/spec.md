## ADDED Requirements

### Requirement: Invoice detail payment snapshot
The invoice detail drawer SHALL preserve its existing invoice, charge, payment, and audit behavior while presenting a read-only payment card sourced only from the invoice profile snapshot.

#### Scenario: Snapshot is available
- **WHEN** a user opens an active invoice with a payment-profile snapshot
- **THEN** the drawer shows bank details, rendered transfer content, QR preview, and building or fallback branding with clear visual hierarchy

#### Scenario: Snapshot is unavailable
- **WHEN** a user opens an invoice without a payment-profile snapshot
- **THEN** the drawer explains that payment instructions were not stored for that invoice and does not display current building profile data

#### Scenario: Responsive detail
- **WHEN** the drawer is viewed on a narrow screen
- **THEN** payment content, QR, charge details, and existing actions remain readable without nested interactive controls or horizontal page overflow
