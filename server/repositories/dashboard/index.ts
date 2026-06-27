import { serverSupabaseClient } from '#supabase/server'
import type { H3Event } from 'h3'
import type { DashboardSummary, BuildingRoomStats, PendingOperation } from '~/types/dashboard'

function emptyRoomStats(): BuildingRoomStats {
  return { total: 0, available: 0, occupied: 0, maintenance: 0 }
}

function periodToken(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

function sixMonthWindowStart(year: number, month: number): { startYear: number; startMonth: number } {
  // Window covers the last 6 months including the current month
  let startMonth = month - 5
  let startYear = year
  while (startMonth <= 0) {
    startMonth += 12
    startYear -= 1
  }
  return { startYear, startMonth }
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
  async getSummary(event: H3Event): Promise<{ summary: DashboardSummary; generatedAt: string }> {
    const client = await serverSupabaseClient(event)

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
    const { startYear, startMonth } = sixMonthWindowStart(currentYear, currentMonth)

    const [
      buildingsResult,
      roomsResult,
      tenantsResult,
      activeContractsResult,
      expiringContractsResult,
      expiringUrgentContractsResult,
      periodsResult,
      invoicesResult,
    ] = await Promise.all([
      client.from('buildings').select('id, slug, name').order('name', { ascending: true }),
      client.from('rooms').select('id, status, building_id').limit(ROOMS_LIMIT),
      client.from('tenants').select('*', { count: 'exact', head: true }),
      client.from('contracts').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      client
        .from('contracts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')
        .gte('end_date', today)
        .lte('end_date', expiringSoonDate),
      client
        .from('contracts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')
        .gte('end_date', today)
        .lte('end_date', expiringUrgentDate),
      client
        .from('billing_periods')
        .select('id, building_id, period_year, period_month, status')
        .limit(BILLING_PERIODS_LIMIT),
      client
        .from('invoices')
        .select(
          'billing_period_id, billing_periods!inner(building_id, period_year, period_month), total_amount, paid_amount, balance_amount, status, due_date',
        )
        .or(
          `period_year.gt.${startYear},and(period_year.eq.${startYear},period_month.gte.${startMonth})`,
          { foreignTable: 'billing_periods' },
        )
        .limit(INVOICES_LIMIT),
    ])

    if (buildingsResult.error) throwInternal(buildingsResult.error, 'dashboard.repository.buildings')
    if (roomsResult.error) throwInternal(roomsResult.error, 'dashboard.repository.rooms')
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
    const trendByPeriod = new Map<string, { period: string; invoiceTotal: number; paidAmount: number; outstandingAmount: number; overdueAmount: number }>()
    const overdueAmountByBuilding = new Map<string, number>()

    for (const invoice of allInvoices) {
      if (invoice.status === 'void') continue
      const period = periodById.get(invoice.billing_period_id)
      if (!period) continue
      const token = periodToken(period.period_year, period.period_month)
      const trend = trendByPeriod.get(token) ?? { period: token, invoiceTotal: 0, paidAmount: 0, outstandingAmount: 0, overdueAmount: 0 }
      const balance = Number(invoice.balance_amount ?? 0)
      const isOverdue = balance > 0 && Boolean(invoice.due_date && invoice.due_date < today)

      trend.invoiceTotal += Number(invoice.total_amount ?? 0)
      trend.paidAmount += Number(invoice.paid_amount ?? 0)
      trend.outstandingAmount += balance
      if (isOverdue) trend.overdueAmount += balance
      trendByPeriod.set(token, trend)

      if (isOverdue) {
        const accum = overdueAmountByBuilding.get(period.building_id) ?? 0
        overdueAmountByBuilding.set(period.building_id, accum + balance)
      }

      if (currentPeriodIds.has(invoice.billing_period_id)) {
        invoiceTotal += Number(invoice.total_amount ?? 0)
        paidAmount += Number(invoice.paid_amount ?? 0)
        outstandingAmount += balance
        if (isOverdue) overdueAmount += balance
      }
    }

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
      tenants: { total: tenantsResult.count ?? 0 },
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
      billingTrend: [...trendByPeriod.values()]
        .sort((a, b) => a.period.localeCompare(b.period))
        .slice(-6),
      pendingOperations,
    }

    return { summary, generatedAt: new Date().toISOString() }
  },
}
