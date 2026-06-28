import { describe, expect, it } from 'vitest'
import {
  billingWorkspaceInvoicePath,
  billingWorkspacePath,
  buildingPath,
  contractPath,
  invoicePath,
  pendingOperationPath,
  roomPath,
  tenantPath,
} from '../../app/utils/routes/operational'

describe('operational route helpers', () => {
  it('prefers persisted building slug and falls back to id only', () => {
    expect(buildingPath({ id: 'building-id', slug: 'toa-a', name: 'Toa A' })).toBe('/buildings/toa-a')
    expect(buildingPath({ id: 'building-id' })).toBe('/buildings/building-id')
    expect(buildingPath({ id: 'building-id', name: 'Toa A' })).toBe('/buildings/building-id')
  })

  it('builds scoped room and billing routes', () => {
    const building = { id: 'building-id', slug: 'toa-a', name: 'Toa A' }
    expect(roomPath({ id: 'room-id', code: 'toa-a101', roomNumber: 'A101', building })).toBe('/rooms/toa-a101')
    expect(roomPath({ id: 'room-id', roomNumber: 'A101', building })).toBe('/buildings/toa-a/rooms/a101')
    expect(billingWorkspacePath(building, 2026, 6)).toBe('/billing/toa-a/2026-06')
    expect(billingWorkspaceInvoicePath(building, 2026, 6, 'invoice-id')).toBe('/billing/toa-a/2026-06?invoice=invoice-id')
  })

  it('uses business code when present and keeps tenant id routes non-PII', () => {
    expect(contractPath({ id: 'contract-id', contractCode: 'hd-zhpn-2026-0001' })).toBe('/contracts/hd-zhpn-2026-0001')
    expect(contractPath({ id: 'contract-id' })).toBe('/contracts/contract-id')
    expect(invoicePath({ id: 'invoice-id', invoiceCode: 'inv-2026-05-0001' })).toBe('/billing/invoices/inv-2026-05-0001')
    expect(invoicePath({ id: 'invoice-id' })).toBe('/billing/invoices/invoice-id')
    expect(tenantPath({ code: 'nva-2026-0001' })).toBe('/tenants/nva-2026-0001')
  })

  it('pendingOperationPath builds billing workspace link from period token', () => {
    const item = {
      building: { id: 'b1', slug: 'toa-a', name: 'Toa A' },
      period: '2026-06',
    }
    expect(pendingOperationPath(item)).toBe('/billing/toa-a/2026-06')
  })

  it('pendingOperationPath falls back to building id when slug missing', () => {
    const item = {
      building: { id: 'b1' },
      period: '2026-12',
    }
    expect(pendingOperationPath(item)).toBe('/billing/b1/2026-12')
  })
})
