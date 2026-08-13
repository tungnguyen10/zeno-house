## MODIFIED Requirements

### Requirement: Invoice snapshot print data
The system SHALL build printable invoices from persisted invoice, charge, and payment-profile snapshots while using the invoice's current paid and balance totals. It SHALL never substitute the building's current payment profile for a missing or historical invoice snapshot.

#### Scenario: Source configuration changed after issue
- **WHEN** pricing, service configuration, readings, or the building payment profile change after an invoice was issued
- **THEN** the printed charge lines, charge total, bank instructions, QR, and logo remain those persisted at issue time

#### Scenario: Payment state changed after issue
- **WHEN** payments change the invoice paid and balance totals
- **THEN** a newly loaded print preview shows the current paid and balance totals

#### Scenario: Legacy invoice has no payment snapshot
- **WHEN** an otherwise printable invoice has a null payment-profile snapshot
- **THEN** the artifact shows a neutral contact-management message and no current-profile QR

### Requirement: Printable invoice artifact
The print route SHALL render “Phiếu tính tiền nhà tháng MM/YYYY” with invoice identity, building, room, tenant, dates, a six-column charge snapshot table, total, paid amount, balance, status, and snapshotted payment instructions.

#### Scenario: Charge table renders meter metadata
- **WHEN** an electricity or water charge snapshot contains old and new readings
- **THEN** the artifact shows old reading, new reading, quantity, unit price, and amount in the corresponding table columns

#### Scenario: Print A4 output
- **WHEN** the user opens the native print dialog
- **THEN** application chrome is hidden, each invoice stays unbroken, and at most two invoice cards are placed on each A4 portrait page

#### Scenario: Payment footer renders
- **WHEN** an invoice has a payment-profile snapshot
- **THEN** bank details and rendered transfer content appear beside the snapshotted QR, using the snapshotted building logo or the Zeno logo fallback

#### Scenario: Print data cannot load
- **WHEN** permission, scope, status, asset signing, or data validation fails
- **THEN** the print page shows the server error and disables **In ngay**
