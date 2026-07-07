import { BuildingRepository } from '../../../repositories/buildings'
import { OperationsReportService } from '../../../services/operations-report/report'

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

  const buildings = await BuildingRepository.findAll(event, {
    page: 1,
    limit: 1000,
    status: ['active'],
    sort: 'name',
    order: 'asc',
    buildingIds: null,
  })
  const results = []
  for (const building of buildings.items) {
    try {
      const closure = await OperationsReportService.closeSystem(event, {
        building_id: building.id,
        period_year: period.year,
        period_month: period.month,
      })
      results.push({ buildingId: building.id, status: 'closed', closureId: closure.id })
    }
    catch (error) {
      results.push({
        buildingId: building.id,
        status: 'failed',
        message: error instanceof Error ? error.message : 'unknown',
      })
    }
  }

  return {
    data: {
      skipped: false,
      periodYear: period.year,
      periodMonth: period.month,
      closed: results.filter(result => result.status === 'closed').length,
      results,
    },
  }
})
