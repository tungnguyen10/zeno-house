## ADDED Requirements

### Requirement: Due amendment scheduler wake-up
Supabase Cron SHALL use `pg_net` and Vault-backed configuration to invoke the private due-amendment worker without embedding its URL or secret in migration source.

#### Scenario: Scheduled amendment application is due
- **WHEN** the configured amendment schedule runs
- **THEN** Supabase sends the private authenticated request and the idempotent worker applies every eligible due amendment

#### Scenario: Worker wake-up fails
- **WHEN** the HTTP wake-up does not complete
- **THEN** amendment state remains retryable and billing retains its pre-draft safety call
