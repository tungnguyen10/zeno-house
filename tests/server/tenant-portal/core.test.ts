import { describe, expect, it } from 'vitest'
import {
  tenantInvoiceListQuerySchema,
  tenantProfileUpdateSchema,
} from '~/utils/validators/tenant-portal'
import {
  mapTenantContractSummary,
  mapTenantInvoiceDetail,
  mapTenantInvoiceListItem,
  mapTenantProfile,
} from '~/utils/mappers/tenant-portal'

describe('tenant portal validators', () => {
  it('keeps only profile contact fields', () => {
    const result = tenantProfileUpdateSchema.parse({
      phone: '0901234567',
      email: 'tenant@example.com',
      status: 'archived',
      id_number: '012345678901',
      tenant_id: 'another-tenant',
    })

    expect(result).toEqual({
      phone: '0901234567',
      email: 'tenant@example.com',
    })
  })

  it('rejects profile updates with no whitelisted fields', () => {
    expect(tenantProfileUpdateSchema.safeParse({ status: 'archived', tenant_id: 'tenant-2' }).success).toBe(false)
    expect(tenantProfileUpdateSchema.safeParse({}).success).toBe(false)
  })

  it('normalizes invoice pagination defaults and bounds', () => {
    expect(tenantInvoiceListQuerySchema.parse({})).toEqual({ page: 1, page_size: 20 })
    expect(tenantInvoiceListQuerySchema.safeParse({ page_size: 101 }).success).toBe(false)
  })
})

describe('tenant portal mappers', () => {
  it('maps only safe tenant profile fields', () => {
    const profile = mapTenantProfile({
      id: 'tenant-1',
      code: 'T-001',
      full_name: 'Nguyen Van A',
      phone: '0901234567',
      email: 'tenant@example.com',
      emergency_contact_name: 'Tran Thi B',
      emergency_contact_phone: '0907654321',
      notes: 'Call after 5pm',
    })

    expect(profile).toEqual({
      id: 'tenant-1',
      code: 'T-001',
      fullName: 'Nguyen Van A',
      phone: '0901234567',
      email: 'tenant@example.com',
      emergencyContactName: 'Tran Thi B',
      emergencyContactPhone: '0907654321',
      notes: 'Call after 5pm',
    })
  })

  it('maps an active contract summary with room and building labels', () => {
    const summary = mapTenantContractSummary({
      id: 'contract-1',
      contract_code: 'C-001',
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      monthly_rent: 5000000,
      deposit: 10000000,
      status: 'active',
      rooms: { room_number: 'A101', buildings: { name: 'Zeno One' } },
    })

    expect(summary).toMatchObject({
      id: 'contract-1',
      contractCode: 'C-001',
      roomNumber: 'A101',
      buildingName: 'Zeno One',
      monthlyRent: 5000000,
      deposit: 10000000,
      status: 'active',
    })
  })

  it('maps invoice list and detail into camel-case DTOs', () => {
    const row = {
      id: 'invoice-1',
      invoice_code: 'INV-001',
      billing_period_id: 'period-1',
      period_year: 2026,
      period_month: 7,
      building_id: 'building-1',
      building_name: 'Zeno One',
      building_slug: 'zeno-one',
      room_id: 'room-1',
      room_number: 'A101',
      contract_id: 'contract-1',
      contract_code: 'C-001',
      tenant_id: 'tenant-1',
      tenant_name: 'Nguyen Van A',
      total_amount: 5500000,
      paid_amount: 1000000,
      balance_amount: 4500000,
      due_date: '2026-07-10',
      status: 'overdue' as const,
      issued_at: '2026-07-01T00:00:00.000Z',
      voided_at: null,
      void_reason: null,
      notes: null,
    }

    const item = mapTenantInvoiceListItem(row)
    expect(item).toMatchObject({
      id: 'invoice-1',
      invoiceCode: 'INV-001',
      periodYear: 2026,
      roomNumber: 'A101',
      status: 'overdue',
      balanceAmount: 4500000,
    })

    const detail = mapTenantInvoiceDetail(row, [{
      id: 'charge-1',
      invoice_id: 'invoice-1',
      charge_type: 'rent',
      label: 'Rent',
      quantity: 1,
      unit_price: 5000000,
      amount: 5000000,
      sort_order: 0,
    }])
    expect(detail.charges).toEqual([{
      id: 'charge-1',
      chargeType: 'rent',
      label: 'Rent',
      quantity: 1,
      unitPrice: 5000000,
      amount: 5000000,
      sortOrder: 0,
    }])
  })
})
