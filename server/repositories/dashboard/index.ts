import type { H3Event } from 'h3'
import type { DashboardSummary, BuildingRoomStats, PendingOperation, RevenueCategoryKey, RevenueCategoryAmounts } from '~/types/dashboard'
import { db } from '../../utils/db'

function emptyRoomStats(): BuildingRoomStats {
  return { total: 0, available: 0, occupied: 0, maintenance: 0 }
}

function emptyCategoryAmounts(): RevenueCategoryAmounts {
  return { rent: 0, electricity: 0, water: 0, service: 0, other: 0 }
}

function bucketCharge(chargeType: string): RevenueCategoryKey {
  switch (chargeType) {
    case 'rent': return 'rent'
    case 'electricity': return 'electricity'
    case 'water': return 'water'
    case 'service': return 'service'
    default: return 'other'
  }
}

function periodToken(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

const TREND_WINDOW_MONTHS = 12

function trendWindowStart(year: number, _month: number): { startYear: number; startMonth: number } {
  // Window covers the calendar year (Jan–Dec) of the current year
  return { startYear: year, startMonth: 1 }
}

type TrendBucket = {
  period: string
  invoiceTotal: number
  paidAmount: number
  outstandingAmount: number
  overdueAmount: number
  categories: RevenueCategoryAmounts
  byBuilding: Record<string, { invoiceTotal: number; paidAmount: number; categories: RevenueCategoryAmounts }>
}

interface DashboardSourceSnapshot {
  buildings: Array<{ id: string, slug: string, name: string }>
  rooms: Array<{ id: string, status: string, building_id: string }>
  tenant_count: number
  active_contract_count: number
  expiring_contract_count: number
  urgent_contract_count: number
  periods: Array<{ id: string, building_id: string, period_year: number, period_month: number, status: string }>
  invoices: Array<{
    billing_period_id: string
    total_amount: number | string
    paid_amount: number | string
    balance_amount: number | string
    status: string
    due_date: string | null
    invoice_charges: Array<{ charge_type: string, amount: number | string }>
  }>
}

function buildFullTrend(buckets: Map<string, TrendBucket>, currentYear: number, currentMonth: number): TrendBucket[] {
  const { startYear, startMonth } = trendWindowStart(currentYear, currentMonth)
  const out: TrendBucket[] = []
  let year = startYear
  let month = startMonth
  for (let i = 0; i < TREND_WINDOW_MONTHS; i++) {
    const token = periodToken(year, month)
    out.push(buckets.get(token) ?? {
      period: token,
      invoiceTotal: 0,
      paidAmount: 0,
      outstandingAmount: 0,
      overdueAmount: 0,
      categories: emptyCategoryAmounts(),
      byBuilding: {},
    })
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }
  return out
}

const SEVERITY_WEIGHT: Record<PendingOperation['severity'], number> = {
  danger: 3,
  warning: 2,
  info: 1,
}

export const DashboardRepository = {
  async getSummary(
    event: H3Event,
    buildingIds?: string[] | null,
  ): Promise<{ summary: DashboardSummary; generatedAt: string }> {
    const client = db(event)
    const scopedBuildingIds = buildingIds ?? null

    if (scopedBuildingIds && scopedBuildingIds.length === 0) {
      return {
        summary: {
          buildings: { total: 0 },
          rooms: emptyRoomStats(),
          tenants: { total: 0 },
          contracts: { active: 0, expiringSoon: 0, expiringUrgent: 0 },
          billing: {
            currentMonth: {
              period: periodToken(new Date().getFullYear(), new Date().getMonth() + 1),
              invoiceTotal: 0,
              paidAmount: 0,
              outstandingAmount: 0,
              overdueAmount: 0,
              collectionRate: 0,
            },
          },
          buildingBreakdown: [],
          billingTrend: buildFullTrend(new Map(), new Date().getFullYear(), new Date().getMonth() + 1),
          revenueBreakdown: { totalIssued: 0, totalPaid: 0, categories: [] },
          pendingOperations: [],
        },
        generatedAt: new Date().toISOString(),
      }
    }

    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1
    const currentPeriod = periodToken(currentYear, currentMonth)
    const today = now.toISOString().slice(0, 10)
    const expiringSoon = new Date(now)
    expiringSoon.setDate(expiringSoon.getDate() + 30)
    const expiringSoonDate = expiringSoon.toISOString().slice(0, 10)
    const expiringUrgent = new Date(now)
    expiringUrgent.setDate(expiringUrgent.getDate() + 7)
    const expiringUrgentDate = expiringUrgent.toISOString().slice(0, 10)
    const { startYear, startMonth } = trendWindowStart(currentYear, currentMonth)

    const { data, error } = await client.rpc('dashboard_source_snapshot' as never, {
      p_building_ids: scopedBuildingIds,
      p_current_year: currentYear,
      p_current_month: currentMonth,
      p_today: today,
      p_expiring_soon: expiringSoonDate,
      p_expiring_urgent: expiringUrgentDate,
    } as never)
    if (error) throwInternal(error, 'dashboard.repository.snapshot')
    const snapshot = data as unknown as DashboardSourceSnapshot
    const buildings = snapshot.buildings ?? []
    const allRooms = snapshot.rooms ?? []
    const allPeriods = snapshot.periods ?? []
    const allInvoices = snapshot.invoices ?? []

    // Aggregate global room stats
    const roomStats: BuildingRoomStats = allRooms.reduce((acc, room) => {
      acc.total++
      if (room.status === 'available') acc.available++
      else if (room.status === 'occupied') acc.occupied++
      else if (room.status === 'maintenance') acc.maintenance++
      return acc
    }, emptyRoomStats())

    // Aggregate per-building room stats
    const roomsByBuilding = new Map<string, BuildingRoomStats>()
    for (const room of allRooms) {
      if (!roomsByBuilding.has(room.building_id)) {
        roomsByBuilding.set(room.building_id, emptyRoomStats())
      }
      const stats = roomsByBuilding.get(room.building_id)!
      stats.total++
      if (room.status === 'available') stats.available++
      else if (room.status === 'occupied') stats.occupied++
      else if (room.status === 'maintenance') stats.maintenance++
    }

    const buildingBreakdown = buildings.map((b) => ({
      id: b.id,
      slug: b.slug,
      name: b.name,
      rooms: roomsByBuilding.get(b.id) ?? emptyRoomStats(),
    }))

    const currentPeriodIds = new Set(
      allPeriods
        .filter(p => p.period_year === currentYear && p.period_month === currentMonth)
        .map(p => p.id),
    )
    const periodById = new Map(allPeriods.map(p => [p.id, p]))
    const buildingById = new Map(buildings.map(b => [b.id, b]))

    let invoiceTotal = 0
    let paidAmount = 0
    let outstandingAmount = 0
    let overdueAmount = 0
    let windowIssuedTotal = 0
    let windowPaidTotal = 0
    const trendByPeriod = new Map<string, TrendBucket>()
    const overdueAmountByBuilding = new Map<string, number>()
    const revenueByCategory = new Map<RevenueCategoryKey, number>()
    const windowStartToken = startYear * 12 + startMonth
    const windowEndToken = windowStartToken + TREND_WINDOW_MONTHS - 1

    for (const invoice of allInvoices) {
      if (invoice.status === 'void') continue
      const period = periodById.get(invoice.billing_period_id)
      if (!period) continue
      const periodTokenNum = period.period_year * 12 + period.period_month
      if (periodTokenNum < windowStartToken || periodTokenNum > windowEndToken) continue
      const token = periodToken(period.period_year, period.period_month)
      const trend = trendByPeriod.get(token) ?? {
        period: token,
        invoiceTotal: 0,
        paidAmount: 0,
        outstandingAmount: 0,
        overdueAmount: 0,
        categories: emptyCategoryAmounts(),
        byBuilding: {},
      }
      const total = Number(invoice.total_amount ?? 0)
      const paid = Number(invoice.paid_amount ?? 0)
      const balance = Number(invoice.balance_amount ?? 0)
      const isOverdue = balance > 0 && Boolean(invoice.due_date && invoice.due_date < today)

      trend.invoiceTotal += total
      trend.paidAmount += paid
      trend.outstandingAmount += balance
      if (isOverdue) trend.overdueAmount += balance

      const buildingBucket = trend.byBuilding[period.building_id] ?? {
        invoiceTotal: 0,
        paidAmount: 0,
        categories: emptyCategoryAmounts(),
      }
      buildingBucket.invoiceTotal += total
      buildingBucket.paidAmount += paid
      trend.byBuilding[period.building_id] = buildingBucket

      trendByPeriod.set(token, trend)

      windowIssuedTotal += total
      windowPaidTotal += paid

      const charges = (invoice as { invoice_charges?: { charge_type: string; amount: number | string }[] }).invoice_charges ?? []
      for (const charge of charges) {
        const key = bucketCharge(charge.charge_type)
        const amount = Number(charge.amount ?? 0)
        revenueByCategory.set(key, (revenueByCategory.get(key) ?? 0) + amount)
        trend.categories[key] += amount
        buildingBucket.categories[key] += amount
      }

      if (isOverdue) {
        const accum = overdueAmountByBuilding.get(period.building_id) ?? 0
        overdueAmountByBuilding.set(period.building_id, accum + balance)
      }

      if (currentPeriodIds.has(invoice.billing_period_id)) {
        invoiceTotal += total
        paidAmount += paid
        outstandingAmount += balance
        if (isOverdue) overdueAmount += balance
      }
    }

    const categoryOrder: RevenueCategoryKey[] = ['rent', 'electricity', 'water', 'service', 'other']
    const revenueCategories = categoryOrder
      .map((key) => ({ key, amount: revenueByCategory.get(key) ?? 0 }))
      .filter(entry => entry.amount > 0)

    const collectionRate = invoiceTotal === 0
      ? 0
      : Math.round((paidAmount / invoiceTotal) * 10000) / 10000

    const pendingOperations: DashboardSummary['pendingOperations'] = []
    for (const period of allPeriods) {
      if (period.period_year !== currentYear || period.period_month !== currentMonth) continue
      const building = buildingById.get(period.building_id)
      if (!building) continue
      const buildingRef = { id: building.id, slug: building.slug, name: building.name }
      if (period.status === 'draft' || period.status === 'readings') {
        pendingOperations.push({
          type: 'missing_readings',
          building: buildingRef,
          period: currentPeriod,
          count: 1,
          severity: 'warning',
        })
      }
      if (period.status === 'review') {
        pendingOperations.push({
          type: 'unissued_invoices',
          building: buildingRef,
          period: currentPeriod,
          count: 1,
          severity: 'info',
        })
      }
    }

    for (const building of buildings) {
      const overdueCount = allInvoices.filter((invoice) => {
        const period = periodById.get(invoice.billing_period_id)
        return period?.building_id === building.id
          && invoice.status !== 'void'
          && Number(invoice.balance_amount ?? 0) > 0
          && Boolean(invoice.due_date && invoice.due_date < today)
      }).length
      if (overdueCount > 0) {
        pendingOperations.push({
          type: 'overdue_invoices',
          building: { id: building.id, slug: building.slug, name: building.name },
          period: currentPeriod,
          count: overdueCount,
          severity: 'danger',
          amount: overdueAmountByBuilding.get(building.id) ?? 0,
        })
      }
    }

    pendingOperations.sort((a, b) => {
      const sev = SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity]
      if (sev !== 0) return sev
      const amt = (b.amount ?? 0) - (a.amount ?? 0)
      if (amt !== 0) return amt
      const per = b.period.localeCompare(a.period)
      if (per !== 0) return per
      return a.building.name.localeCompare(b.building.name)
    })

    const summary: DashboardSummary = {
      buildings: { total: buildings.length },
      rooms: roomStats,
      tenants: { total: Number(snapshot.tenant_count ?? 0) },
      contracts: {
        active: Number(snapshot.active_contract_count ?? 0),
        expiringSoon: Number(snapshot.expiring_contract_count ?? 0),
        expiringUrgent: Number(snapshot.urgent_contract_count ?? 0),
      },
      billing: {
        currentMonth: {
          period: currentPeriod,
          invoiceTotal,
          paidAmount,
          outstandingAmount,
          overdueAmount,
          collectionRate,
        },
      },
      buildingBreakdown,
      billingTrend: buildFullTrend(trendByPeriod, currentYear, currentMonth),
      revenueBreakdown: {
        totalIssued: windowIssuedTotal,
        totalPaid: windowPaidTotal,
        categories: revenueCategories,
      },
      pendingOperations,
    }

    return { summary, generatedAt: new Date().toISOString() }
  },
}
