## ADDED Requirements

### Requirement: Bulk persistence is set-based and preserves domain semantics
Bulk APIs SHALL validate inputs before persistence and use bounded set-based database operations; financial bulk operations MUST execute atomically while non-financial operations SHALL preserve their documented per-item result semantics.

#### Scenario: Financial batch contains an invalid item
- **WHEN** one item in a bulk payment transaction fails validation or persistence
- **THEN** no payment or invoice total from that batch is committed

#### Scenario: Large non-financial batch
- **WHEN** a supported room, tenant, contract, meter-reading, or shared-expense batch grows in item count
- **THEN** database round trips do not grow linearly with item count
