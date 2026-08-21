## ADDED Requirements

### Requirement: Contract lifecycle reconciles scheduled amendments
Contract termination and full renewal SHALL cancel any scheduled amendment for the source contract with a durable system reason before completing the lifecycle transition.

#### Scenario: Terminate contract with scheduled amendment
- **WHEN** an authorized user terminates a contract that has a scheduled amendment
- **THEN** the amendment is cancelled in the correlated operation and cannot later apply

### Requirement: Published amendments protect contract history
Contract deletion safety checks SHALL report retained scheduled, applied, or cancelled published amendments as blockers. Force delete SHALL NOT bypass amendment-history blockers.

#### Scenario: Delete contract with applied amendment
- **WHEN** an authorized user requests normal or force deletion of a contract with applied amendment history
- **THEN** deletion is rejected with an amendment-history blocker
