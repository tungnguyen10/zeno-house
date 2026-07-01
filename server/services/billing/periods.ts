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
import { InvoicePaymentRepository } from '../../repositories/billing/payments'
import { BuildingRepository } from '../../repositories/buildings'
import { assertReason } from '../../utils/billing/reason'
import { assertBuildingScope, getAssignedBuildingIds } from '../../utils/scope'
import { BillingAuditService } from './audit'
import {
  loadBillableContractsInPeriod,
  loadRequiredReadingProgress,
  type BillableContractPeriodRow,
} from './core'
import { assertPeriodCanTransition } from './rules'

interface BuildingLite {
  id: string
  slug: string | null
  name: string | null
  defaultElectricityRate: number | null
  defaultWaterRate: number | null
  electricityPricingType: string | null
  waterPricingType: string | null
}

async function loadBuildingsByIds(event: H3Event, ids: string[]): Promise<Map<string, BuildingLite>> {
  if (ids.length === 0) return new Map()
  const supabase = await serverSupabaseClient(event)
  const { data, error } = await supabase
    .from('buildings')
    .select('id, slug, name, electricity_pricing_type, default_electricity_rate, water_pricing_type, default_water_rate')
    .in('id', ids)
  if (error) throw createError({ statusCode: 500, message: error.message })
  return new Map(
    (data ?? []).map(b => [
      b.id,
      {
        id: b.id,
        slug: b.slug ?? null,
        name: b.name ?? null,
        electricityPricingType: b.electricity_pricing_type ?? null,
        defaultElectricityRate: b.default_electricity_rate === null ? null : Number(b.default_electricity_rate),
        waterPricingType: b.water_pricing_type ?? null,
        defaultWaterRate: b.default_water_rate === null ? null : Number(b.default_water_rate),
      },
    ]),
  )
}

async function loadBillableContractsForPeriod(
  event: H3Event,
  buildingId: string,
  periodYear: number,
  periodMonth: number,
): Promise<BillableContractPeriodRow[]> {
  return loadBillableContractsInPeriod<BillableContractPeriodRow>(event, {
    buildingId,
    periodYear,
    periodMonth,
    select: 'id, building_id, room_id, start_date, end_date, status',
  })
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

    let buildingId = filters.building_id
    const scopedBuildingIds = await getAssignedBuildingIds(event, user)
    if (buildingId) {
      const building = await BuildingRepository.findByIdentifier(event, buildingId)
      if (!building) throwNotFound('Không tìm thấy tòa nhà')
      if (scopedBuildingIds && !scopedBuildingIds.includes(building.id)) return []
      buildingId = building.id
    }

    const repoFilters: BillingPeriodListFilters = {
      building_id: buildingId,
      buildingIds: scopedBuildingIds,
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

      const building = buildingMap.get(period.buildingId)
      const contracts = await loadBillableContractsForPeriod(
        event,
        period.buildingId,
        period.periodYear,
        period.periodMonth,
      )
      const reading = await loadRequiredReadingProgress(
        event,
        {
          buildingId: period.buildingId,
          periodId: period.id,
          periodYear: period.periodYear,
          periodMonth: period.periodMonth,
          pricing: {
            electricity_pricing_type: building?.electricityPricingType ?? null,
            water_pricing_type: building?.waterPricingType ?? null,
          },
          contracts,
        },
      )

      summaries.push({
        period,
        buildingId: period.buildingId,
        buildingSlug: building?.slug ?? null,
        buildingName: building?.name ?? null,
        contractCount: contracts.length,
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

    const building = await BuildingRepository.findByIdentifier(event, input.building_id)
    if (!building) throwNotFound('Không tìm thấy tòa nhà')
    await assertBuildingScope(event, user, building.id, 'write')

    const existing = await BillingPeriodRepository.findByBuildingPeriod(
      event,
      building.id,
      input.period_year,
      input.period_month,
    )
    if (existing) return existing

    const created = await BillingPeriodRepository.insert(event, {
      building_id: building.id,
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
    await assertBuildingScope(event, user, period.buildingId, 'read')
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
    await assertBuildingScope(event, user, period.buildingId, 'read')

    const buildingMap = await loadBuildingsByIds(event, [period.buildingId])
    const building = buildingMap.get(period.buildingId)
    const invoices = await InvoiceRepository.listByPeriod(event, period.id)
    const activeInvoices = invoices.filter(i => i.status !== 'void')

    const issuedTotal = activeInvoices.reduce((s, i) => s + i.totalAmount, 0)
    const paidTotal = activeInvoices.reduce((s, i) => s + i.paidAmount, 0)
    const outstanding = activeInvoices.reduce((s, i) => s + i.balanceAmount, 0)

    const contracts = await loadBillableContractsForPeriod(
      event,
      period.buildingId,
      period.periodYear,
      period.periodMonth,
    )
    const reading = await loadRequiredReadingProgress(
      event,
      {
        buildingId: period.buildingId,
        periodId: period.id,
        periodYear: period.periodYear,
        periodMonth: period.periodMonth,
        pricing: {
          electricity_pricing_type: building?.electricityPricingType ?? null,
          water_pricing_type: building?.waterPricingType ?? null,
        },
        contracts,
      },
    )
    const auditEvents = await BillingAuditService.listByPeriod(event, user, period.id)

    return {
      period,
      buildingId: period.buildingId,
      buildingName: building?.name ?? null,
      contractCount: contracts.length,
      invoiceCount: activeInvoices.length,
      readingCompleteCount: reading.complete,
      readingRequiredCount: reading.required,
      draftTotal: 0, // overview does not run draft calc; clients fetch /drafts to see draftTotal.
      issuedTotal,
      paidTotal,
      outstandingBalance: outstanding,
      auditEvents,
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
    await assertBuildingScope(event, user, period.buildingId, 'write')
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
    await assertBuildingScope(event, user, period.buildingId, 'write')
    assertPeriodCanTransition(period.status, next)
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

  /**
   * Unissue a period: void every invoice that has zero successful payments and
   * retain invoices that already received any payment. The period drops back
   * to `draft` if everything was voided, or stays in `collecting` so the
   * remaining paid invoices can continue to be tracked while readings/issuing
   * is reopened. Requires `billing.unissue`.
   */
  async unissue(
    event: H3Event,
    user: AuthUser,
    id: string,
    reasonInput: string,
  ): Promise<{ voided: number; retained: number; status: BillingPeriod['status'] }> {
    if (!can(user, 'billing.unissue')) throwForbidden('Không có quyền huỷ phát hành kỳ')
    const reason = assertReason(reasonInput, 10)

    const period = await BillingPeriodRepository.findById(event, id)
    if (!period) throwNotFound('Không tìm thấy kỳ vận hành')
    await assertBuildingScope(event, user, period.buildingId, 'write')
    if (period.status === 'closed') throwConflict('Kỳ đã chốt — không thể huỷ phát hành')

    const invoices = await InvoiceRepository.listByPeriod(event, period.id)
    const active = invoices.filter(inv => inv.status !== 'void')

    const voidTargets: typeof active = []
    const retained: typeof active = []
    for (const inv of active) {
      if (inv.paidAmount > 0) {
        retained.push(inv)
        continue
      }
      const payments = await InvoicePaymentRepository.listByInvoice(event, inv.id)
      if (payments.length > 0) retained.push(inv)
      else voidTargets.push(inv)
    }

    for (const inv of voidTargets) {
      const voided = await InvoiceRepository.voidById(event, inv.id, user.id ?? null, reason)
      await BillingAuditService.append(event, user, {
        billing_period_id: period.id,
        action: BILLING_AUDIT_ACTIONS.INVOICE_VOIDED,
        entity_type: 'invoice',
        entity_id: inv.id,
        before_data: inv,
        after_data: voided,
        metadata: {
          reason,
          total_amount: inv.totalAmount,
          contract_id: inv.contractId,
          via: 'period.unissue',
        },
      })
    }

    const nextStatus: BillingPeriod['status'] = retained.length === 0 ? 'draft' : 'collecting'
    let updated = period
    if (period.status !== nextStatus) {
      updated = await BillingPeriodRepository.updateStatus(event, period.id, nextStatus, {})
    }

    await BillingAuditService.append(event, user, {
      billing_period_id: period.id,
      action: BILLING_AUDIT_ACTIONS.PERIOD_UNISSUED,
      entity_type: 'billing_period',
      entity_id: period.id,
      before_data: { status: period.status },
      after_data: { status: updated.status },
      metadata: {
        reason,
        voided_count: voidTargets.length,
        retained_paid_count: retained.length,
        retained_invoice_ids: retained.map(inv => inv.id),
      },
    })

    return {
      voided: voidTargets.length,
      retained: retained.length,
      status: updated.status,
    }
  },

  /**
   * Reopen a closed period back to `collecting` so corrections can be made
   * (e.g. undo a payment, fix a reading). Requires `billing.close` and a reason
   * (≥ 10 chars) that is recorded in the audit trail. The period must currently
   * be `closed`; any other status is a conflict. `closed_at` is cleared.
   */
  async reopen(
    event: H3Event,
    user: AuthUser,
    id: string,
    reasonInput: string,
  ): Promise<BillingPeriod> {
    if (!can(user, 'billing.close')) throwForbidden('Không có quyền mở lại kỳ vận hành')
    const reason = assertReason(reasonInput, 10)

    const period = await BillingPeriodRepository.findById(event, id)
    if (!period) throwNotFound('Không tìm thấy kỳ vận hành')
    await assertBuildingScope(event, user, period.buildingId, 'write')
    if (period.status !== 'closed') {
      throwConflict('Kỳ chưa chốt — không thể mở lại')
    }

    const reopened = await BillingPeriodRepository.updateStatus(event, period.id, 'collecting', {
      closed_at: null,
    })

    await BillingAuditService.append(event, user, {
      billing_period_id: reopened.id,
      action: BILLING_AUDIT_ACTIONS.PERIOD_REOPENED,
      entity_type: 'billing_period',
      entity_id: reopened.id,
      before_data: period,
      after_data: reopened,
      metadata: {
        reason,
        prior_status: period.status,
        trigger: 'manual',
      },
    })

    return reopened
  },
}
