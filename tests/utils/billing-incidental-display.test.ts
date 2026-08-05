import { chargeLineLabel, groupChargeLines } from '../../app/utils/billing/charge-groups'

describe('incidental charge display', () => {
  it('keeps incidental lines in a distinct display group', () => {
    const groups = groupChargeLines([
      { chargeType: 'service', sortOrder: 3, amount: 50_000 },
      { chargeType: 'incidental', sortOrder: 80, amount: 150_000 },
    ])

    expect(groups).toEqual([
      { key: 'service', title: 'Dịch vụ', lines: [{ chargeType: 'service', sortOrder: 3, amount: 50_000 }], subtotal: 50_000 },
      { key: 'incidental', title: 'Khoản phát sinh', lines: [{ chargeType: 'incidental', sortOrder: 80, amount: 150_000 }], subtotal: 150_000 },
    ])
  })

  it('provides the fallback label for incidental invoice lines', () => {
    expect(chargeLineLabel('incidental', '')).toBe('Khoản phát sinh')
    expect(chargeLineLabel('incidental', 'Thay khóa cửa')).toBe('Thay khóa cửa')
  })
})
