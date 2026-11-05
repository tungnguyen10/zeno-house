import { runMonthEndClose } from '../../../services/billing/month-end-close'

const TIME_ZONE = 'Asia/Ho_Chi_Minh'

function partsInVietnam(date: Date): { year: number, month: number, day: number } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map(part => [part.type, part.value]),
  )
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  }
}

function isLastDayOfMonth(date: Date): boolean {
  const today = partsInVietnam(date)
  const tomorrow = partsInVietnam(new Date(date.getTime() + 24 * 60 * 60 * 1000))
  return today.month !== tomorrow.month || today.year !== tomorrow.year
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const secret = config.operationsReportAutoCloseSecret
  if (!secret || getHeader(event, 'x-operations-report-cron-secret') !== secret) {
    throwForbidden('Không có quyền chạy tự động chốt báo cáo')
  }

  const now = new Date()
  const period = partsInVietnam(now)
  if (!isLastDayOfMonth(now)) {
    return {
      data: {
        skipped: true,
        reason: 'not_last_day_of_month',
        periodYear: period.year,
        periodMonth: period.month,
        closed: 0,
      },
    }
  }

  const summary = await runMonthEndClose(event, { year: period.year, month: period.month })

  return {
    data: {
      skipped: false,
      periodYear: period.year,
      periodMonth: period.month,
      closed: summary.reportsClosed,
      billingClosed: summary.billingClosed,
      results: summary.results,
    },
  }
})
