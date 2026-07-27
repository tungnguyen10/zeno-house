## MODIFIED Requirements

### Requirement: Bounded idempotent delivery dispatcher
The system SHALL dispatch due deliveries in bounded leases, SHALL prevent duplicate sends with a stable Resend idempotency key, and SHALL retry only transient failures within 24 hours. Supabase Cron SHALL wake the server-owned dispatcher every minute through its existing private endpoint.

#### Scenario: Worker claims due jobs
- **WHEN** Supabase Cron wakes the dispatcher while delivery is enabled
- **THEN** it atomically claims at most 20 due or stale-leased deliveries and processes at most three provider calls concurrently

#### Scenario: Global feature or configuration is unavailable
- **WHEN** the feature flag is off or required dispatch secrets are absent
- **THEN** the worker sends nothing, preserves queued jobs, and reports a safe skipped reason
