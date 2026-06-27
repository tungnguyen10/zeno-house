export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount)
}

const BILLION = 1_000_000_000
const MILLION = 1_000_000
const THOUSAND = 1_000

function trimZero(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '')
}

export function formatCurrencyCompact(amount: number): string {
  const sign = amount < 0 ? '-' : ''
  const abs = Math.abs(amount)
  if (abs >= BILLION) return `${sign}${trimZero(abs / BILLION)} tỷ`
  if (abs >= MILLION) return `${sign}${trimZero(abs / MILLION)} tr`
  if (abs >= THOUSAND) return `${sign}${trimZero(abs / THOUSAND)} N`
  return `${sign}${Math.round(abs)}`
}
