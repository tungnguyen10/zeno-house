import type { ApiSuccess } from './api'

export interface BuildingRoomStats {
  total: number
  available: number
  occupied: number
  maintenance: number
}

export interface PendingOperation {
  type: 'missing_readings' | 'unissued_invoices' | 'overdue_invoices'
  building: { id: string; slug: string; name: string }
  period: string
  count: number
  severity: 'info' | 'warning' | 'danger'
  amount?: number
}

export interface BillingTrendEntry {
  period: string
  invoiceTotal: number
  paidAmount: number
  outstandingAmount: number
  overdueAmount: number
}

export interface BuildingBreakdownEntry {
  id: string
  slug: string
  name: string
  rooms: BuildingRoomStats
}

export interface DashboardSummary {
  buildings: { total: number }
  rooms: BuildingRoomStats
  tenants: { total: number }
  contracts: { active: number; expiringSoon: number; expiringUrgent: number }
  billing: {
    currentMonth: {
      period: string
      invoiceTotal: number
      paidAmount: number
      outstandingAmount: number
      overdueAmount: number
      collectionRate: number
    }
  }
  buildingBreakdown: BuildingBreakdownEntry[]
  billingTrend: BillingTrendEntry[]
  pendingOperations: PendingOperation[]
}

export interface DashboardSummaryMeta extends Record<string, unknown> {
  generatedAt: string
}

export type DashboardSummaryResponse = ApiSuccess<DashboardSummary, DashboardSummaryMeta>
