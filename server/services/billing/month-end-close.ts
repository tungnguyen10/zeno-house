import type { H3Event } from 'h3'
import { BillingPeriodRepository } from '../../repositories/billing/periods'
import { BuildingRepository } from '../../repositories/buildings'
import { OperationsReportService } from '../operations-report/report'
import { BillingPeriodService, type SystemCloseOutcome } from './periods'

export type MonthEndBillingResult =
  | SystemCloseOutcome
  | { status: 'skipped', reason: 'no_period' }
  | { status: 'failed', message: string }

export type MonthEndReportResult =
  | { status: 'closed' }
  | { status: 'failed', message: string }

export interface MonthEndCloseBuildingResult {
  buildingId: string
  billing: MonthEndBillingResult
  report: MonthEndReportResult
}

export interface MonthEndCloseSummary {
  billingClosed: number
  reportsClosed: number
  results: MonthEndCloseBuildingResult[]
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown'
}

/**
 * Closes each active building's billing period first (so the reserve accrual is written once by
 * billing), then its operations report. Periods with unpaid invoices stay open for an admin.
 */
export async function runMonthEndClose(
  event: H3Event,
  period: { year: number, month: number },
): Promise<MonthEndCloseSummary> {
  const buildings = await BuildingRepository.findAll(event, {
    page: 1,
    limit: 1000,
    status: ['active'],
    sort: 'name',
    order: 'asc',
    buildingIds: null,
  })

  const results: MonthEndCloseBuildingResult[] = []
  for (const building of buildings.items) {
    let billing: MonthEndBillingResult
    try {
      const billingPeriod = await BillingPeriodRepository.findByBuildingPeriod(
        event, building.id, period.year, period.month,
      )
      billing = billingPeriod
        ? await BillingPeriodService.closeSystem(event, billingPeriod)
        : { status: 'skipped', reason: 'no_period' }
    }
    catch (error) {
      billing = { status: 'failed', message: errorMessage(error) }
    }

    let report: MonthEndReportResult
    try {
      await OperationsReportService.closeSystem(event, {
        building_id: building.id,
        period_year: period.year,
        period_month: period.month,
      })
      report = { status: 'closed' }
    }
    catch (error) {
      report = { status: 'failed', message: errorMessage(error) }
    }

    results.push({ buildingId: building.id, billing, report })
  }

  return {
    billingClosed: results.filter(result => result.billing.status === 'closed').length,
    reportsClosed: results.filter(result => result.report.status === 'closed').length,
    results,
  }
}
