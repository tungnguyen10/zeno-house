import type { H3Event } from 'h3'
import { serverSupabaseClient } from '#supabase/server'
import type { AuthUser } from '~/types/auth'
import type {
  BillingPeriod,
  BillingPeriodListFilters,
  BillingPeriodSummary,
  BillingWorkspaceOverview,
} from '~/types/billing'
import { BILLING_AUDIT_ACTIONS } from '~/utils/constants/billing'
import type {
  BillingPeriodListQuery,
  BillingPeriodOpenInput,
} from '~/utils/validators/billing'
import { BillingPeriodRepository } from '../../repositories/billing/periods'
import { InvoiceRepository } from '../../repositories/billing/invoices'
import { BillingAuditService } from './audit'

interface BuildingLite {
  id: string
  name: string | null
  defaultElectricityRate: number | null
  defaultWaterRate: number | null
}

async function loadBuildingsByIds(event: H3Event, ids: string[]): Promise<Map<string, BuildingLite>> {
  if (ids.length === 0) return new Map()
  const supabase = await serverSupabaseClient(event)
  const { data, error } = await supabase
    .from('buildings')
    .select('id, name, default_electricity_rate, default_water_rate')
    .in('id', ids)
  if (error) throw createError({ statusCode: 500, message: error.message })
  return new Map(
    (data ?? []).map(b => [
      b.id,
      {
        id: b.id,
        name: b.name ?? null,
        defaultElectricityRate: b.default_electricity_rate === null ? null : Number(b.default_electricity_rate),
        defaultWaterRate: b.default_water_rate === null ? null : Number(b.default_water_rate),
      },
    ]),
  )
}

async function loadActiveContractCountForBuilding(
  event: H3Event,
  buildingId: string,
  periodYear: number,
  periodMonth: number,
): Promise<number> {
  const supabase = await serverSupabaseClient(event)
  // Active contracts are those whose start_date <= last day of period and (end_date is null OR end_date >= first day of period) and status = 'active'.
  const firstDay = new Date(Date.UTC(periodYear, periodMonth - 1, 1))
  const lastDay = new Date(Date.UTC(periodYear, periodMonth, 0))
  const firstStr = firstDay.toISOString().slice(0, 10)
  const lastStr = lastDay.toISOString().slice(0, 10)
  const { count, error } = await supabase
    .from('contracts')
    .select('id', { count: 'exact', head: true })
    .eq('building_id', buildingId)
    .lte('start_date', lastStr)
    .or(`end_date.gte.${firstStr},end_date.is.null`)
  if (error) throw createError({ statusCode: 500, message: error.message })
  return count ?? 0
}

async function loadReadingProgress(
  event: H3Event,
  buildingId: string,
  periodYear: number,
  periodMonth: number,
): Promise<{ complete: number; required: number }> {
  const supabase = await serverSupabaseClient(event)
  const { data: rooms, error } = await supabase
    .from('rooms')
    .select('id, status')
    .eq('building_id', buildingId)
  if (error) throw createError({ statusCode: 500, message: error.message })
  const occupiedRooms = (rooms ?? []).filter(r => r.status === 'occupied')
  const required = occupiedRooms.length * 2 // electricity + water per occupied room
  if (occupiedRooms.length === 0) return { complete: 0, required: 0 }
  const roomIds = occupiedRooms.map(r => r.id)
  const { data: readings, error: readErr } = await supabase
    .from('meter_readings')
    .select('room_id, meter_type')
    .in('room_id', roomIds)
    .eq('period_year', periodYear)
    .eq('period_month', periodMonth)
  if (readErr) throw createError({ statusCode: 500, message: readErr.message })
  return { complete: readings?.length ?? 0, required }
}

export const BillingPeriodService = {
  /**
   * List billing periods with filters, joined with building name and aggregate
   * counts/totals for the workspace queue.
   */
  async list(
    event: H3Event,
    user: AuthUser,
    filters: BillingPeriodListQuery,
  ): Promise<BillingPeriodSummary[]> {
    if (!can(user, 'billing.read')) throwForbidden('Không có quyền xem kỳ vận hành')

    const repoFilters: BillingPeriodListFilters = {
      building_id: filters.building_id,
      period_year: filters.period_year,
      period_month: filters.period_month,
      status: filters.status,
    }
    const periods = await BillingPeriodRepository.list(event, repoFilters)
    if (periods.length === 0) return []

    const buildingIds = [...new Set(periods.map(p => p.buildingId))]
    const buildingMap = await loadBuildingsByIds(event, buildingIds)

    const summaries: BillingPeriodSummary[] = []
    for (const period of periods) {
      const invoices = await InvoiceRepository.listByPeriod(event, period.id)
      const activeInvoices = invoices.filter(i => i.status !== 'void')
      const issuedTotal = activeInvoices.reduce((s, i) => s + i.totalAmount, 0)
      const paidTotal = activeInvoices.reduce((s, i) => s + i.paidAmount, 0)
      const outstanding = activeInvoices.reduce((s, i) => s + i.balanceAmount, 0)

      const contractCount = await loadActiveContractCountForBuilding(
        event,
        period.buildingId,
        period.periodYear,
        period.periodMonth,
      )
      const reading = await loadReadingProgress(
        event,
        period.buildingId,
        period.periodYear,
        period.periodMonth,
      )

      const building = buildingMap.get(period.buildingId)
      summaries.push({
        period,
        buildingId: period.buildingId,
        buildingName: building?.name ?? null,
        contractCount,
        invoiceCount: activeInvoices.length,
        readingCompleteCount: reading.complete,
        readingRequiredCount: reading.required,
        issuedTotal,
        paidTotal,
        outstandingBalance: outstanding,
      })
    }

    if (filters.has_debt === true) {
      return summaries.filter(s => s.outstandingBalance > 0)
    }
    return summaries
  },

  /**
   * Open or get a billing period for a building/year/month. Creates a new
   * period in `draft` status if one does not exist yet. Idempotent.
   */
  async openOrGet(
    event: H3Event,
    user: AuthUser,
    input: BillingPeriodOpenInput,
  ): Promise<BillingPeriod> {
    if (!can(user, 'billing.write')) throwForbidden('Không có quyền tạo kỳ vận hành')

    const existing = await BillingPeriodRepository.findByBuildingPeriod(
      event,
      input.building_id,
      input.period_year,
      input.period_month,
    )
    if (existing) return existing

    const created = await BillingPeriodRepository.insert(event, {
      building_id: input.building_id,
      period_year: input.period_year,
      period_month: input.period_month,
      opened_by: user.id ?? null,
    })

    await BillingAuditService.append(event, user, {
      billing_period_id: created.id,
      action: BILLING_AUDIT_ACTIONS.PERIOD_OPENED,
      entity_type: 'billing_period',
      entity_id: created.id,
      after_data: created,
      metadata: { building_id: created.buildingId, period_year: created.periodYear, period_month: created.periodMonth },
    })

    return created
  },

  async getById(
    event: H3Event,
    user: AuthUser,
    id: string,
  ): Promise<BillingPeriod> {
    if (!can(user, 'billing.read')) throwForbidden('Không có quyền xem kỳ vận hành')
    const period = await BillingPeriodRepository.findById(event, id)
    if (!period) throwNotFound('Không tìm thấy kỳ vận hành')
    return period
  },

  /**
   * Workspace overview metrics for one period. Combines period data with
   * building name, invoice totals, contract count, and reading progress.
   */
  async getOverview(
    event: H3Event,
    user: AuthUser,
    id: string,
  ): Promise<BillingWorkspaceOverview> {
    if (!can(user, 'billing.read')) throwForbidden('Không có quyền xem kỳ vận hành')
    const period = await BillingPeriodRepository.findById(event, id)
    if (!period) throwNotFound('Không tìm thấy kỳ vận hành')

    const buildingMap = await loadBuildingsByIds(event, [period.buildingId])
    const building = buildingMap.get(period.buildingId)
    const invoices = await InvoiceRepository.listByPeriod(event, period.id)
    const activeInvoices = invoices.filter(i => i.status !== 'void')

    const issuedTotal = activeInvoices.reduce((s, i) => s + i.totalAmount, 0)
    const paidTotal = activeInvoices.reduce((s, i) => s + i.paidAmount, 0)
    const outstanding = activeInvoices.reduce((s, i) => s + i.balanceAmount, 0)

    const contractCount = await loadActiveContractCountForBuilding(
      event,
      period.buildingId,
      period.periodYear,
      period.periodMonth,
    )
    const reading = await loadReadingProgress(
      event,
      period.buildingId,
      period.periodYear,
      period.periodMonth,
    )

    return {
      period,
      buildingId: period.buildingId,
      buildingName: building?.name ?? null,
      contractCount,
      invoiceCount: activeInvoices.length,
      readingCompleteCount: reading.complete,
      readingRequiredCount: reading.required,
      draftTotal: 0, // overview does not run draft calc; clients fetch /drafts to see draftTotal.
      issuedTotal,
      paidTotal,
      outstandingBalance: outstanding,
    }
  },

  /**
   * Close a period. Requires `billing.close`. The period may only be closed
   * from `issued` or `collecting` and only when no invoice has an outstanding
   * balance.
   */
  async close(
    event: H3Event,
    user: AuthUser,
    id: string,
  ): Promise<BillingPeriod> {
    if (!can(user, 'billing.close')) throwForbidden('Không có quyền chốt kỳ vận hành')

    const period = await BillingPeriodRepository.findById(event, id)
    if (!period) throwNotFound('Không tìm thấy kỳ vận hành')
    if (period.status === 'closed') return period
    if (period.status !== 'issued' && period.status !== 'collecting') {
      throwConflict('Chỉ có thể chốt kỳ đã phát hành hoặc đang thu')
    }

    const outstanding = await InvoiceRepository.listOutstandingByPeriod(event, period.id)
    if (outstanding.length > 0) {
      throwConflict(`Còn ${outstanding.length} hoá đơn chưa thanh toán đủ. Cần xử lý trước khi chốt kỳ.`)
    }

    const closed = await BillingPeriodRepository.updateStatus(event, period.id, 'closed', {
      closed_at: new Date().toISOString(),
    })

    await BillingAuditService.append(event, user, {
      billing_period_id: closed.id,
      action: BILLING_AUDIT_ACTIONS.PERIOD_CLOSED,
      entity_type: 'billing_period',
      entity_id: closed.id,
      before_data: period,
      after_data: closed,
    })

    return closed
  },

  /**
   * Internal helper to advance period status when triggered by another flow
   * (e.g. issuing invoices moves period to `issued`). Skips audit on no-op.
   */
  async advanceStatus(
    event: H3Event,
    user: AuthUser,
    id: string,
    next: BillingPeriod['status'],
  ): Promise<BillingPeriod> {
    const period = await BillingPeriodRepository.findById(event, id)
    if (!period) throwNotFound('Không tìm thấy kỳ vận hành')
    if (period.status === next) return period
    const updated = await BillingPeriodRepository.updateStatus(event, period.id, next, {
      issued_at: next === 'issued' ? new Date().toISOString() : undefined,
    })
    await BillingAuditService.append(event, user, {
      billing_period_id: updated.id,
      action: BILLING_AUDIT_ACTIONS.PERIOD_STATUS_CHANGED,
      entity_type: 'billing_period',
      entity_id: updated.id,
      before_data: { status: period.status },
      after_data: { status: updated.status },
    })
    return updated
  },
}
