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

export const REVENUE_CATEGORY_COLOR: Record<RevenueCategoryKey, string> = {
  rent: '#00E5FF',
  electricity: '#FFB539',
  water: '#38BDF8',
  service: '#32D74B',
  other: '#98989D',
}
