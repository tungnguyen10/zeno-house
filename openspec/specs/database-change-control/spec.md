## Purpose

Project-wide guardrail for how database schema and data migrations are reviewed and applied. Establishes manual Supabase Dashboard SQL Editor as the canonical application path and forbids relying on automatic `supabase db push` in this codebase. Aligned with architectural decision D0.

## Requirements

### Requirement: Manual database change control
Any database schema or data migration required by a change SHALL be explicitly documented and prepared as SQL for manual execution in Supabase Dashboard SQL Editor. The implementation SHALL NOT assume automatic database application through `supabase db push`.

#### Scenario: Schema change is required
- **WHEN** implementation requires adding, dropping, or altering a database object
- **THEN** the change documents the exact table/object, SQL operation, column definitions, constraints, indexes, policies, backfill behavior, data-loss risk, verification query, and rollback note

#### Scenario: No schema change is required
- **WHEN** implementation can be completed using the existing schema
- **THEN** the implementation notes explicitly state that no database schema changes are required

#### Scenario: Manual Supabase execution
- **WHEN** SQL must be applied
- **THEN** the SQL is written so it can be reviewed and executed manually in Supabase Dashboard SQL Editor

#### Scenario: Destructive database operation
- **WHEN** a proposed SQL operation drops data, drops a column, drops a table, or changes constraints in a way that can reject existing rows
- **THEN** the proposal lists the expected data impact and a verification query before execution
