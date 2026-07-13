import type { H3Event } from 'h3'
import type { Tables } from '~/types/database.types'
import type { BillingUtilityUsage, Invoice } from '~/types/billing'
import { mapBillingUtilityUsage, mapInvoice } from '~/utils/mappers/billing'
import { db } from '../../utils/db'

export interface BillingPeriodInputSnapshot {
  building: Tables<'buildings'>
  contracts: Tables<'contracts'>[]
  services: Array<Tables<'contract_services'> & { service_catalog: Tables<'service_catalog'> | null }>
  occupants: Tables<'contract_occupants'>[]
  readings: Tables<'meter_readings'>[]
  overrides: BillingUtilityUsage[]
  invoices: Invoice[]
  rooms: Tables<'rooms'>[]
  tenants: Tables<'tenants'>[]
}

type RawSnapshot = Omit<BillingPeriodInputSnapshot, 'overrides' | 'invoices'> & {
  overrides: Tables<'billing_utility_usages'>[]
  invoices: Tables<'invoices'>[]
}

export const BillingSnapshotRepository = {
  async load(event: H3Event, periodId: string): Promise<BillingPeriodInputSnapshot> {
    const client = db(event)
    const { data, error } = await client.rpc('billing_period_input_snapshot' as never, {
      p_period_id: periodId,
    } as never)
    if (error) throwDbError(error, 'billing.snapshot.load')
    const raw = data as unknown as RawSnapshot
    return {
      ...raw,
      overrides: (raw.overrides ?? []).map(mapBillingUtilityUsage),
      invoices: (raw.invoices ?? []).map(mapInvoice),
    }
  },
}
