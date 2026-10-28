import type { RevenueCategoryKey } from '~/types/dashboard'

export const REVENUE_CATEGORY_ORDER: RevenueCategoryKey[] = [
  'rent',
  'electricity',
  'water',
  'service',
  'other',
]

export const REVENUE_CATEGORY_LABEL: Record<RevenueCategoryKey, string> = {
  rent: 'Tiền phòng',
  electricity: 'Điện',
  water: 'Nước',
  service: 'Dịch vụ',
  other: 'Khác',
}
