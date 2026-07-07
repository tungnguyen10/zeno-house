import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type {
  BuildingExpense,
  BuildingReserveFundRate,
  ReserveFund,
  ReserveFundTransaction,
} from '~/types/operations-report'
import type {
  BuildingExpenseCreateInput,
  ReserveFundRateCreateInput,
  ReserveFundRateUpdateInput,
} from '~/utils/validators/operations-report'
import { BuildingRepository } from '../../repositories/buildings'
import { BuildingExpenseRepository } from '../../repositories/operations-report/expenses'
import { ReserveFundRepository } from '../../repositories/operations-report/reserve-funds'
import { assertBuildingScope } from '../../utils/scope'

function ordinal(year: number, month: number): number {
  return year * 12 + month
}

function rangesOverlap(
  aFrom: number,
  aTo: number | null,
  bFrom: number,
  bTo: number | null,
): boolean {
  const aEnd = aTo ?? Number.POSITIVE_INFINITY
  const bEnd = bTo ?? Number.POSITIVE_INFINITY
  return aFrom <= bEnd && bFrom <= aEnd
}

async function requireBuildingAccess(
  event: H3Event,
  user: AuthUser,
  buildingId: string,
  capability: string,
  mode: 'read' | 'write',
) {
  if (!can(user, capability)) throwForbidden('Không có quyền thao tác quỹ dự phòng')
  const building = await BuildingRepository.findById(event, buildingId)
  if (!building) throwNotFound('Không tìm thấy tòa nhà')
  await assertBuildingScope(event, user, buildingId, mode)
}

export const ReserveFundService = {
  async get(event: H3Event, user: AuthUser, buildingId: string): Promise<ReserveFund> {
    await requireBuildingAccess(event, user, buildingId, 'reserve-fund.read', 'read')
    return ReserveFundRepository.getByBuilding(event, buildingId)
  },

  async listRates(
    event: H3Event,
    user: AuthUser,
    buildingId: string,
  ): Promise<BuildingReserveFundRate[]> {
    await requireBuildingAccess(event, user, buildingId, 'reserve-fund.read', 'read')
    return ReserveFundRepository.listRatesByBuilding(event, buildingId)
  },

  async createRate(
    event: H3Event,
    user: AuthUser,
    input: ReserveFundRateCreateInput,
  ): Promise<BuildingReserveFundRate> {
    await requireBuildingAccess(event, user, input.building_id, 'reserve-fund.manage', 'write')
    await this.assertNoRateOverlap(event, input.building_id, {
      from: ordinal(input.effective_from_period_year, input.effective_from_period_month),
      to:
        input.effective_to_period_year != null && input.effective_to_period_month != null
          ? ordinal(input.effective_to_period_year, input.effective_to_period_month)
          : null,
    })
    return ReserveFundRepository.insertRate(event, input, user.id)
  },

  async updateRate(
    event: H3Event,
    user: AuthUser,
    id: string,
    input: ReserveFundRateUpdateInput,
  ): Promise<BuildingReserveFundRate> {
    const existing = await ReserveFundRepository.findRateById(event, id)
    if (!existing) throwNotFound('Không tìm thấy tỷ lệ quỹ dự phòng')
    await requireBuildingAccess(event, user, existing.buildingId, 'reserve-fund.manage', 'write')

    const nextTo =
      input.effective_to_period_year !== undefined || input.effective_to_period_month !== undefined
        ? input.effective_to_period_year != null && input.effective_to_period_month != null
          ? ordinal(input.effective_to_period_year, input.effective_to_period_month)
          : null
        : existing.effectiveToPeriodYear != null && existing.effectiveToPeriodMonth != null
          ? ordinal(existing.effectiveToPeriodYear, existing.effectiveToPeriodMonth)
          : null
    await this.assertNoRateOverlap(
      event,
      existing.buildingId,
      {
        from: ordinal(existing.effectiveFromPeriodYear, existing.effectiveFromPeriodMonth),
        to: nextTo,
      },
      id,
    )
    return ReserveFundRepository.updateRateById(event, id, input)
  },

  async findEffectiveRate(
    event: H3Event,
    buildingId: string,
    periodYear: number,
    periodMonth: number,
  ): Promise<BuildingReserveFundRate | null> {
    const period = ordinal(periodYear, periodMonth)
    const rates = await ReserveFundRepository.listRatesByBuilding(event, buildingId)
    return rates.find((rate) => {
      const from = ordinal(rate.effectiveFromPeriodYear, rate.effectiveFromPeriodMonth)
      const to =
        rate.effectiveToPeriodYear != null && rate.effectiveToPeriodMonth != null
          ? ordinal(rate.effectiveToPeriodYear, rate.effectiveToPeriodMonth)
          : null
      return from <= period && (to == null || period <= to)
    }) ?? null
  },

  async createReserveFundedExpense(
    event: H3Event,
    user: AuthUser,
    input: BuildingExpenseCreateInput,
  ): Promise<BuildingExpense> {
    await requireBuildingAccess(event, user, input.building_id, 'reserve-fund.manage', 'write')

    const created = await BuildingExpenseRepository.insert(
      event,
      { ...input, funded_by: 'reserve_fund' },
      user.id,
    )
    try {
      await this.syncExpenseDeduction(event, user, created)
    }
    catch (error) {
      await BuildingExpenseRepository.deleteById(event, created.id)
      throw error
    }
    return created
  },

  async syncExpenseDeduction(
    event: H3Event,
    user: AuthUser,
    expense: BuildingExpense,
  ): Promise<ReserveFundTransaction | null> {
    if (expense.fundedBy !== 'reserve_fund' || expense.voidedAt) {
      return this.voidExpenseDeduction(event, user, expense, 'Expense is no longer reserve-funded')
    }
    await requireBuildingAccess(event, user, expense.buildingId, 'reserve-fund.manage', 'write')
    return ReserveFundRepository.upsertExpenseDeduction(event, {
      buildingId: expense.buildingId,
      expenseId: expense.id,
      amount: expense.amount,
      date: expense.expenseDate ?? new Date().toISOString().slice(0, 10),
      periodYear: expense.periodYear,
      periodMonth: expense.periodMonth,
      note: expense.note ?? `Expense ${expense.id}`,
      createdBy: user.id,
    })
  },

  async voidExpenseDeduction(
    event: H3Event,
    user: AuthUser,
    expense: BuildingExpense,
    reason?: string,
  ): Promise<ReserveFundTransaction | null> {
    await requireBuildingAccess(event, user, expense.buildingId, 'reserve-fund.manage', 'write')
    return ReserveFundRepository.voidExpenseDeduction(
      event,
      expense.id,
      user.id,
      reason ?? expense.voidReason ?? 'Reserve-funded expense voided',
    )
  },

  async recordMonthlyAccrual(
    event: H3Event,
    user: AuthUser,
    input: {
      buildingId: string
      periodYear: number
      periodMonth: number
      billingPeriodId: string
      issuedRevenue: number
      issuedProfitByRevenue: number
    },
  ): Promise<ReserveFundTransaction> {
    await requireBuildingAccess(event, user, input.buildingId, 'reserve-fund.manage', 'write')
    const rate = await this.findEffectiveRate(
      event,
      input.buildingId,
      input.periodYear,
      input.periodMonth,
    )
    const reserveRatePercent = rate?.reserveRatePercent ?? 0
    const accrualBase = Math.max(input.issuedProfitByRevenue, 0)
    const amount = Math.round((accrualBase * reserveRatePercent) / 100)
    return ReserveFundRepository.upsertMonthlyAccrual(event, {
      buildingId: input.buildingId,
      periodYear: input.periodYear,
      periodMonth: input.periodMonth,
      billingPeriodId: input.billingPeriodId,
      issuedRevenue: input.issuedRevenue,
      reserveRatePercent,
      amount,
      createdBy: user.id,
    })
  },

  async assertNoRateOverlap(
    event: H3Event,
    buildingId: string,
    range: { from: number, to: number | null },
    excludeId?: string,
  ): Promise<void> {
    const existing = await ReserveFundRepository.listRatesByBuilding(event, buildingId)
    for (const row of existing) {
      if (row.id === excludeId) continue
      const rowFrom = ordinal(row.effectiveFromPeriodYear, row.effectiveFromPeriodMonth)
      const rowTo =
        row.effectiveToPeriodYear != null && row.effectiveToPeriodMonth != null
          ? ordinal(row.effectiveToPeriodYear, row.effectiveToPeriodMonth)
          : null
      if (rangesOverlap(range.from, range.to, rowFrom, rowTo)) {
        throwConflict('Khoảng hiệu lực bị trùng với tỷ lệ quỹ dự phòng đang tồn tại')
      }
    }
  },
}
