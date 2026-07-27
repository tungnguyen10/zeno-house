## ADDED Requirements

### Requirement: Issued-invoice email actions in the payment workspace
When invoice email is globally enabled, the payment and debt step SHALL support manual single and bulk email enqueue for active invoices using the existing current-workspace selection model.

#### Scenario: Operator sends one issued invoice
- **WHEN** an authorized operator invokes **Gửi email** for one active invoice
- **THEN** the workspace confirms the stored primary contact email and queues the delivery without changing invoice or payment state

#### Scenario: Operator sends selected invoices
- **WHEN** an authorized operator selects active invoices and confirms **Gửi email (N)**
- **THEN** the workspace submits at most 100 invoice identifiers and summarizes queued, already-queued, skipped, and failed results

#### Scenario: Mixed eligibility does not abort the batch
- **WHEN** a selected invoice lacks a recipient or becomes void before enqueue
- **THEN** that invoice reports a skipped or failed outcome while other eligible invoices are still queued

#### Scenario: Existing workspace behavior is preserved
- **WHEN** email actions are present, unavailable, loading, or failed
- **THEN** printing, collection, correction, period status, and current selection-clearing behavior continue independently

