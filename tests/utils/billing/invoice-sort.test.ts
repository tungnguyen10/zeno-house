import { describe, expect, it } from 'vitest'
import { compareBillingItems } from '../../../app/utils/billing/invoice-sort'

describe('compareBillingItems', () => {
  it('orders floors before naturally numbered rooms and places missing rooms last', () => {
    const rows = [
      { id: 'missing', floor: null, roomNumber: null },
      { id: 'floor-2', floor: 2, roomNumber: '1' },
      { id: 'room-10', floor: 1, roomNumber: 'P10' },
      { id: 'room-2', floor: 1, roomNumber: 'P2' },
    ]

    expect(rows.sort(compareBillingItems).map(row => row.id))
      .toEqual(['room-2', 'room-10', 'floor-2', 'missing'])
  })

  it('orders contracts and replacement invoices consistently within one room', () => {
    const rows = [
      { id: 'replacement', floor: 1, roomNumber: '2', contractCode: 'HD-2', invoiceCode: 'INV-10' },
      { id: 'other', floor: 1, roomNumber: '2', contractCode: 'HD-10', invoiceCode: 'INV-1' },
      { id: 'original', floor: 1, roomNumber: '2', contractCode: 'HD-2', invoiceCode: 'INV-2' },
    ]

    expect(rows.sort(compareBillingItems).map(row => row.id))
      .toEqual(['original', 'replacement', 'other'])
  })

  it('uses raw identifier order when room and codes are equal', () => {
    const rows = [
      { id: 'invoice-2', contractId: 'contract-2', floor: 1, roomNumber: '2', contractCode: 'HD-2', invoiceCode: 'INV-2' },
      { id: 'invoice-10', contractId: 'contract-10', floor: 1, roomNumber: '2', contractCode: 'HD-2', invoiceCode: 'INV-2' },
    ]

    expect(rows.sort(compareBillingItems).map(row => row.id))
      .toEqual(['invoice-10', 'invoice-2'])
  })
})
