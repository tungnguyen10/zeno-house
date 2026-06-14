import { serverSupabaseClient } from '#supabase/server'
import type { H3Event } from 'h3'
import type { DashboardSummary, BuildingRoomStats } from '~/types/dashboard'

function emptyRoomStats(): BuildingRoomStats {
  return { total: 0, available: 0, occupied: 0, maintenance: 0 }
}

function periodToken(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

export const DashboardRepository = {
  async getSummary(event: H3Event): Promise<DashboardSummary> {
    const client = await serverSupabaseClient(event)

    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1
    const currentPeriod = periodToken(currentYear, currentMonth)
    const today = now.toISOString().slice(0, 10)
    const expiringSoon = new Date(now)
    expiringSoon.setDate(expiringSoon.getDate() + 30)
    const expiringSoonDate = expiringSoon.toISOString().slice(0, 10)

    const [
      buildingsResult,
      roomsResult,
      tenantsResult,
      activeContractsResult,
      expiringContractsResult,
      periodsResult,
      invoicesResult,
    ] = await Promise.all([
      client.from('buildings').select('*', { count: 'exact', head: true }),
      client.from('rooms').select('id, status, building_id'),
      client.from('tenants').select('*', { count: 'exact', head: true }),
      client.from('contracts').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      client
        .from('contracts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')
        .gte('end_date', today)
        .lte('end_date', expiringSoonDate),
      client.from('billing_periods').select('id, building_id, period_year, period_month, status'),
      client.from('invoices').select('billing_period_id, building_id:billing_periods(building_id, period_year, period_month), total_amount, paid_amount, balance_amount, status, due_date'),
    ])

    if (buildingsResult.error) throw createError({ statusCode: 500, message: buildingsResult.error.message })
    if (roomsResult.error) throw createError({ statusCode: 500, message: roomsResult.error.message })
    if (tenantsResult.error) throw createError({ statusCode: 500, message: tenantsResult.error.message })
    if (activeContractsResult.error) throw createError({ statusCode: 500, message: activeContractsResult.error.message })
    if (expiringContractsResult.error) throw createError({ statusCode: 500, message: expiringContractsResult.error.message })
    if (periodsResult.error) throw createError({ statusCode: 500, message: periodsResult.error.message })
    if (invoicesResult.error) throw createError({ statusCode: 500, message: invoicesResult.error.message })

    const { data: buildingRows, error: buildingRowsError } = await client
      .from('buildings')
      .select('id, slug, name')
      .order('name', { ascending: true })
    if (buildingRowsError) throw createError({ statusCode: 500, message: buildingRowsError.message })

    const allRooms = roomsResult.data ?? []

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

    const buildings = buildingRows ?? []
    const buildingBreakdown = buildings.map((b) => ({
      id: b.id,
      slug: b.slug,
      name: b.name,
      rooms: roomsByBuilding.get(b.id) ?? emptyRoomStats(),
    }))

    const currentPeriodIds = new Set(
      (periodsResult.data ?? [])
        .filter(p => p.period_year === currentYear && p.period_month === currentMonth)
        .map(p => p.id),
    )
    const periodById = new Map((periodsResult.data ?? []).map(p => [p.id, p]))
    const buildingById = new Map(buildings.map(b => [b.id, b]))

    let invoiceTotal = 0
    let paidAmount = 0
    let outstandingAmount = 0
    let overdueAmount = 0
    const trendByPeriod = new Map<string, { period: string; invoiceTotal: number; paidAmount: number; outstandingAmount: number }>()

    for (const invoice of invoicesResult.data ?? []) {
      if (invoice.status === 'void') continue
      const period = periodById.get(invoice.billing_period_id)
      if (!period) continue
      const token = periodToken(period.period_year, period.period_month)
      const trend = trendByPeriod.get(token) ?? { period: token, invoiceTotal: 0, paidAmount: 0, outstandingAmount: 0 }
      trend.invoiceTotal += Number(invoice.total_amount ?? 0)
      trend.paidAmount += Number(invoice.paid_amount ?? 0)
      trend.outstandingAmount += Number(invoice.balance_amount ?? 0)
      trendByPeriod.set(token, trend)

      if (currentPeriodIds.has(invoice.billing_period_id)) {
        invoiceTotal += Number(invoice.total_amount ?? 0)
        paidAmount += Number(invoice.paid_amount ?? 0)
        outstandingAmount += Number(invoice.balance_amount ?? 0)
        if (invoice.due_date && invoice.due_date < today) {
          overdueAmount += Number(invoice.balance_amount ?? 0)
        }
      }
    }

    const pendingOperations: DashboardSummary['pendingOperations'] = []
    for (const period of periodsResult.data ?? []) {
      if (period.period_year !== currentYear || period.period_month !== currentMonth) continue
      const building = buildingById.get(period.building_id)
      if (!building) continue
      const href = `/billing/${building.slug}/${currentPeriod}`
      if (period.status === 'draft' || period.status === 'readings') {
        pendingOperations.push({
          type: 'missing_readings',
          buildingId: building.id,
          buildingSlug: building.slug,
          buildingName: building.name,
          period: currentPeriod,
          count: 1,
          severity: 'warning',
          href,
        })
      }
      if (period.status === 'review') {
        pendingOperations.push({
          type: 'unissued_invoices',
          buildingId: building.id,
          buildingSlug: building.slug,
          buildingName: building.name,
          period: currentPeriod,
          count: 1,
          severity: 'info',
          href,
        })
      }
    }

    for (const building of buildings) {
      const overdueCount = (invoicesResult.data ?? []).filter((invoice) => {
        const period = periodById.get(invoice.billing_period_id)
        return period?.building_id === building.id
          && invoice.status !== 'void'
          && Number(invoice.balance_amount ?? 0) > 0
          && Boolean(invoice.due_date && invoice.due_date < today)
      }).length
      if (overdueCount > 0) {
        pendingOperations.push({
          type: 'overdue_invoices',
          buildingId: building.id,
          buildingSlug: building.slug,
          buildingName: building.name,
          period: currentPeriod,
          count: overdueCount,
          severity: 'danger',
          href: `/billing/${building.slug}/${currentPeriod}`,
        })
      }
    }

    return {
      buildings: { total: buildingsResult.count ?? 0 },
      rooms: roomStats,
      tenants: { total: tenantsResult.count ?? 0 },
      contracts: {
        active: activeContractsResult.count ?? 0,
        expiringSoon: expiringContractsResult.count ?? 0,
      },
      billing: {
        currentMonth: {
          period: currentPeriod,
          invoiceTotal,
          paidAmount,
          outstandingAmount,
          overdueAmount,
        },
      },
      buildingBreakdown,
      billingTrend: [...trendByPeriod.values()]
        .sort((a, b) => a.period.localeCompare(b.period))
        .slice(-6),
      pendingOperations,
    }
  },
}
