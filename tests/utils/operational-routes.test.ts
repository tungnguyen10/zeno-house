import { describe, expect, it } from 'vitest'
import {
  billingWorkspaceInvoicePath,
  billingWorkspacePath,
  buildingPath,
  contractPath,
  invoicePath,
  invoicePrintPath,
  pendingOperationPath,
  roomPath,
  tenantPath,
} from '../../app/utils/routes/operational'

describe('operational route helpers', () => {
  it('prefers persisted building slug and falls back to id only', () => {
    expect(buildingPath({ id: 'building-id', slug: 'toa-a', name: 'Toa A' })).toBe('/dashboard/buildings/toa-a')
    expect(buildingPath({ id: 'building-id' })).toBe('/dashboard/buildings/building-id')
    expect(buildingPath({ id: 'building-id', name: 'Toa A' })).toBe('/dashboard/buildings/building-id')
  })

  it('builds scoped room and billing routes', () => {
    const building = { id: 'building-id', slug: 'toa-a', name: 'Toa A' }
    expect(roomPath({ id: 'room-id', code: 'toa-a101', roomNumber: 'A101', building })).toBe('/dashboard/rooms/toa-a101')
    expect(roomPath({ id: 'room-id', roomNumber: 'A101', building })).toBe('/dashboard/buildings/toa-a/rooms/a101')
    expect(billingWorkspacePath(building, 2026, 6)).toBe('/dashboard/billing/toa-a/2026-06')
    expect(billingWorkspaceInvoicePath(building, 2026, 6, 'invoice-id')).toBe('/dashboard/billing/toa-a/2026-06?invoice=invoice-id')
  })

  it('uses business code when present and keeps tenant id routes non-PII', () => {
    expect(contractPath({ id: 'contract-id', contractCode: 'hd-zhpn-2026-0001' })).toBe('/dashboard/contracts/hd-zhpn-2026-0001')
    expect(contractPath({ id: 'contract-id' })).toBe('/dashboard/contracts/contract-id')
    expect(invoicePath({ id: 'invoice-id', invoiceCode: 'inv-2026-05-0001' })).toBe('/dashboard/billing/invoices/inv-2026-05-0001')
    expect(invoicePath({ id: 'invoice-id' })).toBe('/dashboard/billing/invoices/invoice-id')
    expect(tenantPath({ code: 'nva-2026-0001' })).toBe('/dashboard/tenants/nva-2026-0001')
  })

  it('builds one invoice-centric print route with ordered unique ids', () => {
    expect(invoicePrintPath(['invoice-2', 'invoice-1', 'invoice-2']))
      .toBe('/dashboard/invoices/print?ids=invoice-2%2Cinvoice-1')
  })

  it('pendingOperationPath builds billing workspace link from period token', () => {
    const item = {
      building: { id: 'b1', slug: 'toa-a', name: 'Toa A' },
      period: '2026-06',
    }
    expect(pendingOperationPath(item)).toBe('/dashboard/billing/toa-a/2026-06')
  })

  it('pendingOperationPath falls back to building id when slug missing', () => {
    const item = {
      building: { id: 'b1' },
      period: '2026-12',
    }
    expect(pendingOperationPath(item)).toBe('/dashboard/billing/b1/2026-12')
  })
})
