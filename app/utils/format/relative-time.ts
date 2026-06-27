import { formatDateTimeShort } from './time'

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function formatRelativeTime(input: string | Date | null | undefined, now: Date = new Date()): string {
  if (!input) return ''
  const target = typeof input === 'string' ? new Date(input) : input
  if (Number.isNaN(target.getTime())) return ''

  const diff = now.getTime() - target.getTime()
  if (diff < 0) return 'Vừa cập nhật'
  if (diff < MINUTE) return 'Vừa cập nhật'
  if (diff < HOUR) {
    const minutes = Math.floor(diff / MINUTE)
    return `${minutes} phút trước`
  }
  if (diff < DAY) {
    const hours = Math.floor(diff / HOUR)
    return `${hours} giờ trước`
  }
  return formatDateTimeShort(target)
}
