---
type: Proposed Capability Delta
title: "add-contract-amendments: spec.md"
status: draft
change_state: in-progress
tags: [change, pending-review]
sources:
  - resource: "https://github.com/tungnguyen10/zeno-house/blob/ae95811bbdc1932368b4e6b9ed3e9540399d26e6/openspec/changes/add-contract-amendments/specs/supabase-scheduled-workers/spec.md"
generated:
  by: "process:okf-migration"
  at: "2026-11-06T00:00:00Z"
---

## ADDED Requirements

### Requirement: Due amendment scheduler wake-up
Supabase Cron SHALL use `pg_net` and Vault-backed configuration to invoke the private due-amendment worker without embedding its URL or secret in migration source.

#### Scenario: Scheduled amendment application is due
- **WHEN** the configured amendment schedule runs
- **THEN** Supabase sends the private authenticated request and the idempotent worker applies every eligible due amendment

#### Scenario: Worker wake-up fails
- **WHEN** the HTTP wake-up does not complete
- **THEN** amendment state remains retryable and billing retains its pre-draft safety call
