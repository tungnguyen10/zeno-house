import { serverSupabaseClient } from '#supabase/server'
import type { H3Event } from 'h3'
import type { DashboardSummary, BuildingRoomStats, PendingOperation, RevenueCategoryKey, RevenueCategoryAmounts } from '~/types/dashboard'

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

const ROOMS_LIMIT = 2000
const BILLING_PERIODS_LIMIT = 500
const INVOICES_LIMIT = 2000

export const DashboardRepository = {
  async getSummary(
    event: H3Event,
    buildingIds?: string[] | null,
  ): Promise<{ summary: DashboardSummary; generatedAt: string }> {
    const client = await serverSupabaseClient(event)
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

    let buildingsQuery = client.from('buildings').select('id, slug, name').order('name', { ascending: true })
    let roomsQuery = client.from('rooms').select('id, status, building_id').limit(ROOMS_LIMIT)
    let activeContractsQuery = client.from('contracts').select('*', { count: 'exact', head: true }).eq('status', 'active')
    let expiringContractsQuery = client
      .from('contracts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .gte('end_date', today)
      .lte('end_date', expiringSoonDate)
    let expiringUrgentContractsQuery = client
      .from('contracts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .gte('end_date', today)
      .lte('end_date', expiringUrgentDate)
    let periodsQuery = client
      .from('billing_periods')
      .select('id, building_id, period_year, period_month, status')
      .limit(BILLING_PERIODS_LIMIT)

    if (scopedBuildingIds) {
      buildingsQuery = buildingsQuery.in('id', scopedBuildingIds)
      roomsQuery = roomsQuery.in('building_id', scopedBuildingIds)
      activeContractsQuery = activeContractsQuery.in('building_id', scopedBuildingIds)
      expiringContractsQuery = expiringContractsQuery.in('building_id', scopedBuildingIds)
      expiringUrgentContractsQuery = expiringUrgentContractsQuery.in('building_id', scopedBuildingIds)
      periodsQuery = periodsQuery.in('building_id', scopedBuildingIds)
    }

    const [
      buildingsResult,
      roomsResult,
      tenantContractsResult,
      tenantOccupantsResult,
      tenantsResult,
      activeContractsResult,
      expiringContractsResult,
      expiringUrgentContractsResult,
      periodsResult,
    ] = await Promise.all([
      buildingsQuery,
      roomsQuery,
      scopedBuildingIds
        ? client.from('contracts').select('id, tenant_id').in('building_id', scopedBuildingIds)
        : Promise.resolve({ data: [], error: null }),
      scopedBuildingIds
        ? client
            .from('contract_occupants')
            .select('tenant_id, contracts!inner(building_id)')
            .in('contracts.building_id', scopedBuildingIds)
        : Promise.resolve({ data: [], error: null }),
      scopedBuildingIds
        ? Promise.resolve({ count: 0, error: null })
        : client.from('tenants').select('*', { count: 'exact', head: true }),
      activeContractsQuery,
      expiringContractsQuery,
      expiringUrgentContractsQuery,
      periodsQuery,
    ])

    const scopedPeriodIds = (periodsResult.data ?? []).map(period => period.id)
    const invoicesResult = scopedPeriodIds.length === 0
      ? { data: [], error: null }
      : await client
          .from('invoices')
          .select(
            'billing_period_id, billing_periods!inner(building_id, period_year, period_month), total_amount, paid_amount, balance_amount, status, due_date, invoice_charges(charge_type, amount)',
          )
          .in('billing_period_id', scopedPeriodIds)
          .or(
            `period_year.gt.${startYear},and(period_year.eq.${startYear},period_month.gte.${startMonth})`,
            { foreignTable: 'billing_periods' },
          )
          .limit(INVOICES_LIMIT)

    if (buildingsResult.error) throwInternal(buildingsResult.error, 'dashboard.repository.buildings')
    if (roomsResult.error) throwInternal(roomsResult.error, 'dashboard.repository.rooms')
    if (tenantContractsResult.error) throwInternal(tenantContractsResult.error, 'dashboard.repository.tenantContracts')
    if (tenantOccupantsResult.error) throwInternal(tenantOccupantsResult.error, 'dashboard.repository.tenantOccupants')
    if (tenantsResult.error) throwInternal(tenantsResult.error, 'dashboard.repository.tenants')
    if (activeContractsResult.error) throwInternal(activeContractsResult.error, 'dashboard.repository.activeContracts')
    if (expiringContractsResult.error) throwInternal(expiringContractsResult.error, 'dashboard.repository.expiringContracts')
    if (expiringUrgentContractsResult.error) throwInternal(expiringUrgentContractsResult.error, 'dashboard.repository.expiringUrgentContracts')
    if (periodsResult.error) throwInternal(periodsResult.error, 'dashboard.repository.billingPeriods')
    if (invoicesResult.error) throwInternal(invoicesResult.error, 'dashboard.repository.invoices')

    const buildings = buildingsResult.data ?? []
    const allRooms = roomsResult.data ?? []
    const allPeriods = periodsResult.data ?? []
    const allInvoices = invoicesResult.data ?? []
    const scopedTenantIds = scopedBuildingIds
      ? new Set([
          ...((tenantContractsResult.data ?? []) as { tenant_id: string }[]).map(row => row.tenant_id),
          ...((tenantOccupantsResult.data ?? []) as { tenant_id: string }[]).map(row => row.tenant_id),
        ])
      : null

    if (allRooms.length === ROOMS_LIMIT) console.warn('[dashboard] limit hit: rooms')
    if (allPeriods.length === BILLING_PERIODS_LIMIT) console.warn('[dashboard] limit hit: billing_periods')
    if (allInvoices.length === INVOICES_LIMIT) console.warn('[dashboard] limit hit: invoices')

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
      tenants: { total: scopedTenantIds ? scopedTenantIds.size : tenantsResult.count ?? 0 },
      contracts: {
        active: activeContractsResult.count ?? 0,
        expiringSoon: expiringContractsResult.count ?? 0,
        expiringUrgent: expiringUrgentContractsResult.count ?? 0,
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
