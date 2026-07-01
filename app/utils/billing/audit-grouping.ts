import type { BillingAuditEvent } from '~/types/billing'

export interface AuditGroup {
  key: string
  label: string
  events: BillingAuditEvent[]
}

const DAY_MS = 24 * 60 * 60 * 1000

const MONTH_LABELS = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
]

/**
 * Group audit events into time buckets for the rework drawer: today,
 * yesterday, the last 7 days, then older events grouped by calendar month.
 * Events are assumed pre-sorted newest-first; group order preserves that.
 */
export function groupAuditEvents(events: BillingAuditEvent[], now: Date = new Date()): AuditGroup[] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfYesterday = startOfToday - DAY_MS
  const startOf7DaysAgo = startOfToday - 7 * DAY_MS

  const today: BillingAuditEvent[] = []
  const yesterday: BillingAuditEvent[] = []
  const last7Days: BillingAuditEvent[] = []
  const months = new Map<string, { label: string; events: BillingAuditEvent[] }>()

  for (const ev of events) {
    const date = new Date(ev.createdAt)
    const t = date.getTime()
    if (!Number.isNaN(t) && t >= startOfToday) {
      today.push(ev)
    }
    else if (!Number.isNaN(t) && t >= startOfYesterday) {
      yesterday.push(ev)
    }
    else if (!Number.isNaN(t) && t >= startOf7DaysAgo) {
      last7Days.push(ev)
    }
    else {
      const key = Number.isNaN(t)
        ? 'unknown'
        : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const label = Number.isNaN(t)
        ? 'Không rõ thời điểm'
        : `${MONTH_LABELS[date.getMonth()]}/${date.getFullYear()}`
      const bucket = months.get(key)
      if (bucket) bucket.events.push(ev)
      else months.set(key, { label, events: [ev] })
    }
  }

  const groups: AuditGroup[] = []
  if (today.length) groups.push({ key: 'today', label: 'Hôm nay', events: today })
  if (yesterday.length) groups.push({ key: 'yesterday', label: 'Hôm qua', events: yesterday })
  if (last7Days.length) groups.push({ key: 'last7Days', label: '7 ngày qua', events: last7Days })

  for (const [key, bucket] of [...months.entries()].sort((a, b) => b[0].localeCompare(a[0]))) {
    groups.push({ key, label: bucket.label, events: bucket.events })
  }

  return groups
}
