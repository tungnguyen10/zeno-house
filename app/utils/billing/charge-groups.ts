export type ChargeGroupKey = 'rent' | 'utility' | 'service' | 'adjustment'

export interface ChargeGroup<T> {
  key: ChargeGroupKey
  title: string
  lines: T[]
  subtotal: number
}

interface GroupableLine {
  chargeType: string
  sortOrder: number
  amount: number
}

const GROUP_TITLES: Record<ChargeGroupKey, string> = {
  rent: 'Tiền phòng',
  utility: 'Tiện ích',
  service: 'Dịch vụ',
  adjustment: 'Điều chỉnh',
}

const GROUP_ORDER: ChargeGroupKey[] = ['rent', 'utility', 'service', 'adjustment']

/**
 * Sort and bucket charge lines into display groups.
 * Pass `showAdjustments: false` to suppress the adjustment bucket (default: true).
 */
export function groupChargeLines<T extends GroupableLine>(
  lines: T[],
  options?: { showAdjustments?: boolean },
): ChargeGroup<T>[] {
  const { showAdjustments = true } = options ?? {}
  const buckets: Record<ChargeGroupKey, T[]> = { rent: [], utility: [], service: [], adjustment: [] }

  for (const line of [...lines].sort((a, b) => a.sortOrder - b.sortOrder)) {
    switch (line.chargeType) {
      case 'rent':
        buckets.rent.push(line)
        break
      case 'electricity':
      case 'water':
        buckets.utility.push(line)
        break
      case 'discount':
      case 'surcharge':
      case 'adjustment':
        buckets.adjustment.push(line)
        break
      case 'service':
      default:
        buckets.service.push(line)
    }
  }

  return GROUP_ORDER
    .filter(key => buckets[key].length > 0)
    .filter(key => showAdjustments || key !== 'adjustment')
    .map(key => ({
      key,
      title: GROUP_TITLES[key],
      lines: buckets[key],
      subtotal: buckets[key].reduce((sum, line) => sum + line.amount, 0),
    }))
}

/**
 * Display label for a charge line.
 * Pass `line.label` as the fallback for user-defined types (discount, surcharge, service, etc.).
 */
export function chargeLineLabel(chargeType: string, fallbackLabel: string): string {
  if (chargeType === 'rent') return 'Tiền thuê tháng'
  if (chargeType === 'electricity') return 'Điện'
  if (chargeType === 'water') return 'Nước'
  if (chargeType === 'discount') return fallbackLabel || 'Giảm giá'
  if (chargeType === 'surcharge') return fallbackLabel || 'Phụ thu'
  if (chargeType === 'adjustment') return fallbackLabel || 'Điều chỉnh'
  return fallbackLabel
}

/** Format a billing period as "MM/YYYY" (e.g. "07/2026"). Returns null for null input. */
export function formatPeriodLabel(
  period: { periodMonth: number; periodYear: number } | null | undefined,
): string | null {
  if (!period) return null
  return `${String(period.periodMonth).padStart(2, '0')}/${period.periodYear}`
}
