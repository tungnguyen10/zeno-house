import type { H3Event } from 'h3'
import { serverSupabaseClient } from '#supabase/server'
import type { BillingAuditEntityType } from '~/utils/constants/billing'

type MaybeId = string | null | undefined

export interface ActorDisplay {
  id: string
  name: string | null
  email: string | null
}

export interface TenantDisplay {
  id: string
  fullName: string | null
  email: string | null
  phone: string | null
}

export interface RoomDisplay {
  id: string
  roomNumber: string | null
  buildingId: string | null
}

export interface ContractDisplay {
  id: string
  roomId: string | null
  tenantId: string | null
}

export interface PeriodDisplay {
  id: string
  buildingId: string
  periodYear: number
  periodMonth: number
}

export interface InvoiceDisplay {
  id: string
  billingPeriodId: string
  contractId: string
  roomId: string
  tenantId: string
  totalAmount: number
  balanceAmount: number
}

export interface BillingDisplayContext {
  buildingId?: string | null
  periodToken?: string | null
}

function uniqueIds(ids: MaybeId[]): string[] {
  return [...new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0))]
}

function contractCode(id: MaybeId): string | null {
  return id ? `HĐ ${id.slice(0, 8)}` : null
}

function periodToken(period: PeriodDisplay | null | undefined): string | null {
  if (!period) return null
  return `${period.periodYear}-${String(period.periodMonth).padStart(2, '0')}`
}

export class BillingDisplayResolver {
  private readonly event: H3Event
  private queryCounts: Record<string, number> = {}
  private actors = new Map<string, ActorDisplay | null>()
  private tenants = new Map<string, TenantDisplay | null>()
  private rooms = new Map<string, RoomDisplay | null>()
  private contracts = new Map<string, ContractDisplay | null>()
  private periods = new Map<string, PeriodDisplay | null>()
  private invoices = new Map<string, InvoiceDisplay | null>()

  constructor(event: H3Event) {
    this.event = event
  }

  private countQuery(name: string) {
    this.queryCounts[name] = (this.queryCounts[name] ?? 0) + 1
  }

  stats(): Record<string, number> {
    return { ...this.queryCounts }
  }

  async loadActors(ids: MaybeId[]): Promise<Map<string, ActorDisplay | null>> {
    const missing = uniqueIds(ids).filter(id => !this.actors.has(id))
    for (const id of missing) {
      this.actors.set(id, { id, name: null, email: null })
    }
    return new Map(uniqueIds(ids).map(id => [id, this.actors.get(id) ?? null]))
  }

  async loadTenants(ids: MaybeId[]): Promise<Map<string, TenantDisplay | null>> {
    const missing = uniqueIds(ids).filter(id => !this.tenants.has(id))
    if (missing.length > 0) {
      const client = await serverSupabaseClient(this.event)
      this.countQuery('tenants')
      const { data, error } = await client
        .from('tenants')
        .select('id, full_name, email, phone')
        .in('id', missing)
      if (error) throw createError({ statusCode: 500, message: error.message })
      const found = new Set<string>()
      for (const row of data ?? []) {
        found.add(row.id)
        this.tenants.set(row.id, {
          id: row.id,
          fullName: row.full_name ?? null,
          email: row.email ?? null,
          phone: row.phone ?? null,
        })
      }
      for (const id of missing) {
        if (!found.has(id)) this.tenants.set(id, null)
      }
    }
    return new Map(uniqueIds(ids).map(id => [id, this.tenants.get(id) ?? null]))
  }

  async loadRooms(ids: MaybeId[]): Promise<Map<string, RoomDisplay | null>> {
    const missing = uniqueIds(ids).filter(id => !this.rooms.has(id))
    if (missing.length > 0) {
      const client = await serverSupabaseClient(this.event)
      this.countQuery('rooms')
      const { data, error } = await client
        .from('rooms')
        .select('id, room_number, building_id')
        .in('id', missing)
      if (error) throw createError({ statusCode: 500, message: error.message })
      const found = new Set<string>()
      for (const row of data ?? []) {
        found.add(row.id)
        this.rooms.set(row.id, {
          id: row.id,
          roomNumber: row.room_number ?? null,
          buildingId: row.building_id ?? null,
        })
      }
      for (const id of missing) {
        if (!found.has(id)) this.rooms.set(id, null)
      }
    }
    return new Map(uniqueIds(ids).map(id => [id, this.rooms.get(id) ?? null]))
  }

  async loadContracts(ids: MaybeId[]): Promise<Map<string, ContractDisplay | null>> {
    const missing = uniqueIds(ids).filter(id => !this.contracts.has(id))
    if (missing.length > 0) {
      const client = await serverSupabaseClient(this.event)
      this.countQuery('contracts')
      const { data, error } = await client
        .from('contracts')
        .select('id, room_id, tenant_id')
        .in('id', missing)
      if (error) throw createError({ statusCode: 500, message: error.message })
      const found = new Set<string>()
      for (const row of data ?? []) {
        found.add(row.id)
        this.contracts.set(row.id, {
          id: row.id,
          roomId: row.room_id ?? null,
          tenantId: row.tenant_id ?? null,
        })
      }
      for (const id of missing) {
        if (!found.has(id)) this.contracts.set(id, null)
      }
    }
    return new Map(uniqueIds(ids).map(id => [id, this.contracts.get(id) ?? null]))
  }

  async loadPeriods(ids: MaybeId[]): Promise<Map<string, PeriodDisplay | null>> {
    const missing = uniqueIds(ids).filter(id => !this.periods.has(id))
    if (missing.length > 0) {
      const client = await serverSupabaseClient(this.event)
      this.countQuery('billing_periods')
      const { data, error } = await client
        .from('billing_periods')
        .select('id, building_id, period_year, period_month')
        .in('id', missing)
      if (error) throw createError({ statusCode: 500, message: error.message })
      const found = new Set<string>()
      for (const row of data ?? []) {
        found.add(row.id)
        this.periods.set(row.id, {
          id: row.id,
          buildingId: row.building_id,
          periodYear: row.period_year,
          periodMonth: row.period_month,
        })
      }
      for (const id of missing) {
        if (!found.has(id)) this.periods.set(id, null)
      }
    }
    return new Map(uniqueIds(ids).map(id => [id, this.periods.get(id) ?? null]))
  }

  async loadInvoices(ids: MaybeId[]): Promise<Map<string, InvoiceDisplay | null>> {
    const missing = uniqueIds(ids).filter(id => !this.invoices.has(id))
    if (missing.length > 0) {
      const client = await serverSupabaseClient(this.event)
      this.countQuery('invoices')
      const { data, error } = await client
        .from('invoices')
        .select('id, billing_period_id, contract_id, room_id, tenant_id, total_amount, balance_amount')
        .in('id', missing)
      if (error) throw createError({ statusCode: 500, message: error.message })
      const found = new Set<string>()
      for (const row of data ?? []) {
        found.add(row.id)
        this.invoices.set(row.id, {
          id: row.id,
          billingPeriodId: row.billing_period_id,
          contractId: row.contract_id,
          roomId: row.room_id,
          tenantId: row.tenant_id,
          totalAmount: Number(row.total_amount),
          balanceAmount: Number(row.balance_amount),
        })
      }
      for (const id of missing) {
        if (!found.has(id)) this.invoices.set(id, null)
      }
    }
    return new Map(uniqueIds(ids).map(id => [id, this.invoices.get(id) ?? null]))
  }

  async enrichInvoices<T extends { tenantId: string; roomId: string; contractId: string }>(invoices: T[]): Promise<Array<T & { tenantName: string | null; roomNumber: string | null; contractCode: string | null }>> {
    const [tenants, rooms] = await Promise.all([
      this.loadTenants(invoices.map(i => i.tenantId)),
      this.loadRooms(invoices.map(i => i.roomId)),
      this.loadContracts(invoices.map(i => i.contractId)),
    ])
    return invoices.map(invoice => ({
      ...invoice,
      tenantName: tenants.get(invoice.tenantId)?.fullName ?? null,
      roomNumber: rooms.get(invoice.roomId)?.roomNumber ?? null,
      contractCode: contractCode(invoice.contractId),
    }))
  }

  async enrichPayments<T extends { recordedBy: string | null }>(payments: T[]): Promise<Array<T & { recordedByName: string | null }>> {
    const actors = await this.loadActors(payments.map(p => p.recordedBy))
    return payments.map(payment => ({
      ...payment,
      recordedByName: payment.recordedBy ? actors.get(payment.recordedBy)?.name ?? null : null,
    }))
  }

  async entityLabel(entityType: BillingAuditEntityType, entityId: MaybeId, ctx: BillingDisplayContext = {}): Promise<{ label: string | null; subLabel: string | null }> {
    if (!entityId) return { label: null, subLabel: null }
    if (entityType === 'billing_period') {
      const period = (await this.loadPeriods([entityId])).get(entityId)
      return {
        label: period ? `Kỳ ${String(period.periodMonth).padStart(2, '0')}/${period.periodYear}` : 'Kỳ vận hành',
        subLabel: null,
      }
    }
    if (entityType === 'invoice') {
      const invoice = (await this.loadInvoices([entityId])).get(entityId)
      if (!invoice) return { label: 'Hoá đơn', subLabel: null }
      const [tenants, rooms, periods] = await Promise.all([
        this.loadTenants([invoice.tenantId]),
        this.loadRooms([invoice.roomId]),
        this.loadPeriods([invoice.billingPeriodId]),
      ])
      const room = rooms.get(invoice.roomId)
      const tenant = tenants.get(invoice.tenantId)
      const period = periods.get(invoice.billingPeriodId)
      return {
        label: `Hoá đơn ${room?.roomNumber ? `P${room.roomNumber}` : invoice.id.slice(0, 8)}${tenant?.fullName ? ` · ${tenant.fullName}` : ''}`,
        subLabel: [periodToken(period), `${Math.trunc(invoice.totalAmount).toLocaleString('vi-VN')}đ`].filter(Boolean).join(' · ') || null,
      }
    }
    if (entityType === 'invoice_payment') return { label: 'Thanh toán', subLabel: null }
    if (entityType === 'invoice_charge') return { label: 'Khoản phí', subLabel: null }
    if (entityType === 'meter_reading') return { label: 'Chỉ số', subLabel: null }
    if (entityType === 'billing_utility_usage') return { label: 'Ghi đè điện/nước', subLabel: null }
    return { label: entityType, subLabel: ctx.periodToken ?? null }
  }

  async entityHref(entityType: BillingAuditEntityType, entityId: MaybeId, ctx: BillingDisplayContext = {}): Promise<string | null> {
    if (!entityId) return null
    if (ctx.buildingId && ctx.periodToken) return `/billing/${ctx.buildingId}/${ctx.periodToken}`
    if (entityType === 'billing_period') {
      const period = (await this.loadPeriods([entityId])).get(entityId)
      const token = periodToken(period)
      return period && token ? `/billing/${period.buildingId}/${token}` : null
    }
    if (entityType === 'invoice') {
      const invoice = (await this.loadInvoices([entityId])).get(entityId)
      if (!invoice) return null
      const period = (await this.loadPeriods([invoice.billingPeriodId])).get(invoice.billingPeriodId)
      const token = periodToken(period)
      return period && token ? `/billing/${period.buildingId}/${token}` : null
    }
    return ctx.buildingId && ctx.periodToken ? `/billing/${ctx.buildingId}/${ctx.periodToken}` : null
  }
}
