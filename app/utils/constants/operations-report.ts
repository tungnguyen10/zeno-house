/**
 * Operations report domain constants: expense/fixed-cost categories and the
 * revenue charge-type groupings used by the building/month report.
 */

/** Fixed-cost categories. MVP ships `rent` only; kept as a list for later. */
export const FIXED_COST_CATEGORIES = ['rent'] as const
export type FixedCostCategory = (typeof FIXED_COST_CATEGORIES)[number]

/** Monthly one-off expense categories. */
export const EXPENSE_CATEGORIES = [
  'electricity_input',
  'water_input',
  'internet',
  'cleaning',
  'repair',
  'admin_fee',
  'supplies',
  'staff',
  'rent_adjustment',
  'insurance',
  'bank_fee',
  'fire_safety',
  'other',
] as const
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

/** Human labels (vi) for expense categories. */
export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  electricity_input: 'Điện đầu vào',
  water_input: 'Nước đầu vào',
  internet: 'Internet / truyền hình',
  cleaning: 'Vệ sinh / rác',
  repair: 'Sửa chữa / bảo trì',
  admin_fee: 'Hành chính / giấy tờ',
  supplies: 'Vật tư vận hành',
  staff: 'Lương nhân sự',
  rent_adjustment: 'Điều chỉnh tiền thuê',
  insurance: 'Bảo hiểm',
  bank_fee: 'Phí ngân hàng',
  fire_safety: 'PCCC',
  other: 'Khác',
}

export const FIXED_COST_CATEGORY_LABELS: Record<FixedCostCategory, string> = {
  rent: 'Tiền thuê nhà',
}

/**
 * Invoice charge types grouped into the report revenue breakdown. Mirrors the
 * `invoice_charges.charge_type` CHECK plus a synthetic `other` bucket.
 */
export const REVENUE_CHARGE_TYPES = [
  'rent',
  'electricity',
  'water',
  'service',
  'discount',
  'surcharge',
  'adjustment',
  'other',
] as const
export type RevenueChargeType = (typeof REVENUE_CHARGE_TYPES)[number]
