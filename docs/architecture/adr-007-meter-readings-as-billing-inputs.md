# ADR-007: Meter Readings Are Billing Inputs, Not Room Metadata

**Status**: Accepted  
**Date**: 2026-06-01  
**Phase**: v0.3

## Context

Meter readings (electricity/water) were already modeled in v0.2.5 as a separate table (`meter_readings`) scoped to room + meter_type + period. In v0.3, billing needs consumption data to calculate utility charges. The question is how meter readings relate to the billing workflow.

## Decision

Meter readings are **billing inputs** entered during a billing run. They are not a permanent historical log attached to a Room page.

### Extended meter_readings fields for billing

The existing `meter_readings` table is extended with 6 new columns:

| Column | Type | Purpose |
|---|---|---|
| `old_reading` | numeric | Previous meter value (auto-populated from latest reading) |
| `new_reading` | numeric | New meter value entered by admin |
| `consumption` | numeric | Calculated or manually overridden value |
| `is_adjusted` | boolean DEFAULT false | Whether consumption was manually overridden |
| `adjustment_reason` | text | Required when is_adjusted = true |
| `updated_by` | uuid FK auth.users | Who last updated the reading |

The legacy `reading_value` column is kept and synced: `reading_value = new_reading` when billing writes.

### Consumption calculation rule

- `is_adjusted = false`: `consumption = new_reading - old_reading`
  - Negative result → warning, generate is **blocked** until fixed
- `is_adjusted = true`: `consumption` is entered manually, `adjustment_reason` is required
  - Use case: meter replaced, meter malfunctioned, meter reset

### No physical meter device model in v0.3

There is no `meter_devices` entity or serial number tracking. A meter is identified implicitly by `(room_id, meter_type)`. Physical device lifecycle (installation, replacement) is deferred.

### old_reading auto-population

When the billing workspace loads, `old_reading` for each room+meter_type is auto-populated from the latest `reading_value` in `meter_readings` for that room+type (regardless of period). If no previous reading exists, the field is left blank and the admin enters it manually.

## Consequences

- Billing write path must sync `reading_value = new_reading` to not break existing meter reading display.
- Negative consumption must be detected at preview stage (warning) and blocked at generate stage (error).
- `adjustment_reason` validation: required if `is_adjusted = true`, enforced at both API (Zod) and service layers.

## Alternatives Considered

**Separate `billing_meter_inputs` table** — dedicate a new table for billing-specific readings, keeping `meter_readings` unchanged. Rejected: adds unnecessary data duplication; the same event (meter snapshot at period end) should live in one place.

**Compute consumption at read time** — store only raw values, calculate consumption on the fly. Rejected: billing snapshot must be immutable once generated; consumption must be persisted at freeze time.
