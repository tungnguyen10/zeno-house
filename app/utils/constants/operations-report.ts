/**
 * Operations report domain constants: expense/fixed-cost categories and the
 * revenue charge-type groupings used by the building/month report.
 */

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

/** Fixed monthly operating costs (can repeat every month for long periods). */
export const FIXED_COST_CATEGORIES = [
  'rent',
  'internet',
  'cleaning',
  'staff',
  'insurance',
  'bank_fee',
  'fire_safety',
  'admin_fee',
  'supplies',
  'other',
] as const
export type FixedCostCategory = (typeof FIXED_COST_CATEGORIES)[number]

/** Reminder cadence for recurring operating expenses. */
export const RECURRING_EXPENSE_FREQUENCIES = [
  'monthly',
  'quarterly',
  'biannual',
  'yearly',
] as const
export type RecurringExpenseFrequency = (typeof RECURRING_EXPENSE_FREQUENCIES)[number]

/** Lifecycle for prepaid expenses. */
export const PREPAID_EXPENSE_STATUSES = [
  'active',
  'expired',
  'cancelled',
] as const
export type PrepaidExpenseStatus = (typeof PREPAID_EXPENSE_STATUSES)[number]

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
  internet: 'Internet / truyền hình',
  cleaning: 'Vệ sinh / rác',
  staff: 'Lương nhân sự',
  insurance: 'Bảo hiểm',
  bank_fee: 'Phí ngân hàng',
  fire_safety: 'PCCC',
  admin_fee: 'Hành chính / giấy tờ',
  supplies: 'Vật tư vận hành',
  other: 'Khác',
}

export const RECURRING_EXPENSE_FREQUENCY_LABELS: Record<RecurringExpenseFrequency, string> = {
  monthly: 'Hàng tháng',
  quarterly: 'Hàng quý',
  biannual: 'Mỗi 6 tháng',
  yearly: 'Hàng năm',
}

export const PREPAID_EXPENSE_STATUS_LABELS: Record<PrepaidExpenseStatus, string> = {
  active: 'Đang phân bổ',
  expired: 'Đã hết hạn',
  cancelled: 'Đã hủy',
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
