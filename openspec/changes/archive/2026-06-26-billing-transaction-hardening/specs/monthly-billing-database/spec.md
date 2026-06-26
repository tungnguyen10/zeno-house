## ADDED Requirements

### Requirement: Billing transaction database functions are additive and documented
Any database function introduced for billing transaction hardening SHALL be additive, manually documented for Supabase Dashboard SQL execution, and include verification and rollback notes.

#### Scenario: Transaction function migration prepared
- **WHEN** implementation introduces billing transaction functions
- **THEN** the SQL migration lists function names, input shapes, affected tables, security posture, verification queries, and rollback statements

#### Scenario: Existing table shape preserved
- **WHEN** billing transaction hardening is applied
- **THEN** existing billing table columns and constraints are not destructively changed unless a separate proposal explicitly approves that change
