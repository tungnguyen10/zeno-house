import type { BillingDraftGridRow, BillingDraftGridUtilityCell } from '~/types/billing'
import { formatCurrency } from '~/utils/format/currency'

export type MeterType = 'electricity' | 'water'

/** Physical unit label for a meter type. */
export function meterUnit(type: MeterType): 'kWh' | 'm³' {
  return type === 'electricity' ? 'kWh' : 'm³'
}

/** Display label for a meter type. */
export function meterLabel(type: MeterType): 'Điện' | 'Nước' {
  return type === 'electricity' ? 'Điện' : 'Nước'
}

/**
 * Unit string for a charge line's chargeType.
 * Returns empty string for non-meter charge types (rent, service, etc.).
 */
export function chargeTypeUnit(chargeType: string): string {
  if (chargeType === 'electricity') return 'kWh'
  if (chargeType === 'water') return 'm³'
  return ''
}

/** Get the meter cell from a grid row by chargeType. */
export function meterCellForLine(
  row: BillingDraftGridRow,
  chargeType: string,
): BillingDraftGridUtilityCell | null {
  if (chargeType === 'electricity') return row.electricity
  if (chargeType === 'water') return row.water
  return null
}

/** Format a number in Vietnamese locale (e.g. 1234 → "1.234"). */
export function formatViNumber(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value)
}

/** Format a meter reading; null renders as '—'. */
export function formatMeterReading(value: number | null): string {
  return value === null ? '—' : formatViNumber(value)
}

/**
 * Format a meter rate as "1.500đ/kWh".
 * Pass a unit string (e.g. from chargeTypeUnit or meterUnit) or leave empty
 * to render a plain currency value.
 */
export function formatMeterRate(value: number | null, unit: string): string {
  if (value === null) return '—'
  return unit ? `${formatCurrency(value)}/${unit}` : formatCurrency(value)
}
