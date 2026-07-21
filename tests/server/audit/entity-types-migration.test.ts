import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AUDIT_ENTITY_TYPES } from '../../../app/utils/constants/audit'

describe('audit entity type persistence', () => {
  it('keeps the database constraint aligned with the shared entity type catalog', () => {
    const migrationsDir = resolve(process.cwd(), 'supabase/migrations')
    const migrationName = readdirSync(migrationsDir)
      .find(name => name.endsWith('_expand_audit_event_coverage.sql'))

    expect(migrationName).toBeDefined()

    const sql = readFileSync(resolve(migrationsDir, migrationName!), 'utf8')
    expect(sql).toContain('audit_events_entity_type_check')
    for (const entityType of AUDIT_ENTITY_TYPES) {
      expect(sql).toContain(`'${entityType}'`)
    }
  })

  it('includes operations and tenant portal entity types that previously failed silently', () => {
    expect(AUDIT_ENTITY_TYPES).toEqual(expect.arrayContaining([
      'recurring_expense',
      'prepaid_expense',
      'support_request',
      'contract_occupant',
      'contract_payment',
      'service_catalog_item',
      'shared_expense',
      'reserve_fund',
      'reserve_fund_rate',
      'operations_report_period',
      'tenant_document',
    ]))
  })
})
