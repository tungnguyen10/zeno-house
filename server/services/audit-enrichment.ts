import { db as serverSupabaseClient } from '../utils/db'
import type { H3Event } from 'h3'
import type { AuditEvent } from '~/types/audit'
import type { Database } from '~/types/database.types'

function pickString(obj: unknown, keys: string[]): string | null {
  if (!obj || typeof obj !== 'object') return null
  const record = obj as Record<string, unknown>
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function snapshot(event: AuditEvent): unknown {
  return event.afterData ?? event.beforeData
}

function fallbackLabel(event: AuditEvent): { label: string | null; sub: string | null } {
  const snap = snapshot(event)
  switch (event.entityType) {
    case 'building':
      return { label: pickString(snap, ['name']), sub: pickString(snap, ['code']) }
    case 'room':
      return { label: pickString(snap, ['room_number']), sub: pickString(snap, ['code']) }
    case 'tenant':
      return { label: pickString(snap, ['full_name']), sub: pickString(snap, ['code', 'phone']) }
    case 'contract':
      return { label: pickString(snap, ['contract_code']), sub: null }
    case 'contract_renewal':
      return { label: pickString(snap, ['contract_code']), sub: null }
    case 'meter_device':
      return { label: pickString(snap, ['serial_number', 'code', 'device_code']), sub: null }
    case 'building_service':
    case 'contract_service':
      return { label: pickString(snap, ['name', 'service_name']), sub: null }
    case 'user':
      return { label: pickString(snap, ['name', 'full_name', 'email']), sub: pickString(snap, ['email']) }
    case 'building_expense':
    case 'building_fixed_cost':
    case 'recurring_expense':
    case 'prepaid_expense':
      return { label: pickString(snap, ['name', 'note', 'category']), sub: pickString(snap, ['category']) }
    case 'shared_expense':
      return { label: pickString(snap, ['name', 'note']), sub: pickString(snap, ['category']) }
    case 'support_request':
      return { label: pickString(snap, ['title']), sub: pickString(snap, ['status']) }
    case 'contract_occupant':
      return { label: pickString(snap, ['tenantName', 'tenant_name', 'fullName', 'full_name']), sub: pickString(snap, ['role']) }
    case 'contract_payment':
      return { label: pickString(snap, ['paymentType', 'payment_type', 'note']), sub: pickString(snap, ['paymentDate', 'payment_date']) }
    case 'service_catalog_item':
    case 'tenant_document':
      return { label: pickString(snap, ['name']), sub: pickString(snap, ['code', 'mime_type']) }
    case 'reserve_fund_rate': {
      const rate = snap && typeof snap === 'object'
        ? (snap as Record<string, unknown>).reserveRatePercent ?? (snap as Record<string, unknown>).reserve_rate_percent
        : null
      return { label: rate != null ? `${rate}%` : null, sub: null }
    }
    case 'operations_report_period': {
      const year = snap && typeof snap === 'object'
        ? (snap as Record<string, unknown>).periodYear ?? (snap as Record<string, unknown>).period_year
        : null
      const month = snap && typeof snap === 'object'
        ? (snap as Record<string, unknown>).periodMonth ?? (snap as Record<string, unknown>).period_month
        : null
      return { label: year && month ? `${String(month).padStart(2, '0')}/${year}` : null, sub: pickString(snap, ['status']) }
    }
    case 'reserve_fund':
      return { label: pickString(snap, ['name', 'note']), sub: null }
    default:
      return { label: null, sub: null }
  }
}

function userDisplayName(user: { user_metadata?: Record<string, unknown> | null }): string | null {
  const metadata = user.user_metadata ?? {}
  for (const key of ['full_name', 'name', 'display_name']) {
    const value = metadata[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

async function loadActors(
  event: H3Event,
  ids: string[],
): Promise<Map<string, { name: string | null; email: string | null }>> {
  const result = new Map<string, { name: string | null; email: string | null }>()
  if (ids.length === 0) return result
  try {
    const client = serverSupabaseClient(event)
    await Promise.all(ids.map(async (id) => {
      const { data, error } = await client.auth.admin.getUserById(id)
      if (error || !data?.user) {
        result.set(id, { name: null, email: null })
        return
      }
      result.set(id, {
        name: userDisplayName(data.user),
        email: data.user.email ?? null,
      })
    }))
  } catch {
    // Service role may not be configured in some runtimes; fall back to raw IDs.
    for (const id of ids) result.set(id, { name: null, email: null })
  }
  return result
}

interface EntityLabel {
  label: string | null
  sub: string | null
}

async function loadEntities(
  event: H3Event,
  buckets: Map<string, Set<string>>,
): Promise<Map<string, EntityLabel>> {
  const result = new Map<string, EntityLabel>()
  if (buckets.size === 0) return result
  const client = await serverSupabaseClient<Database>(event)

  const key = (type: string, id: string) => `${type}:${id}`

  const buildingIds = [...(buckets.get('building') ?? [])]
  const roomIds = [...(buckets.get('room') ?? [])]
  const tenantIds = [...(buckets.get('tenant') ?? [])]
  const contractIds = [...(buckets.get('contract') ?? [])]

  const tasks: Promise<void>[] = []

  if (buildingIds.length > 0) {
    tasks.push((async () => {
      const { data } = await client
        .from('buildings')
        .select('id, name, code')
        .in('id', buildingIds)
      for (const row of data ?? []) {
        result.set(key('building', row.id), { label: row.name, sub: row.code })
      }
    })())
  }

  if (roomIds.length > 0) {
    tasks.push((async () => {
      const { data } = await client
        .from('rooms')
        .select('id, room_number, code, building_id, buildings(name)')
        .in('id', roomIds)
      for (const row of (data ?? []) as Array<{
        id: string
        room_number: string
        code: string | null
        buildings: { name: string } | { name: string }[] | null
      }>) {
        const b = Array.isArray(row.buildings) ? row.buildings[0] : row.buildings
        result.set(key('room', row.id), {
          label: `P.${row.room_number}`,
          sub: b?.name ?? row.code ?? null,
        })
      }
    })())
  }

  if (tenantIds.length > 0) {
    tasks.push((async () => {
      const { data } = await client
        .from('tenants')
        .select('id, full_name, code, phone')
        .in('id', tenantIds)
      for (const row of data ?? []) {
        result.set(key('tenant', row.id), {
          label: row.full_name,
          sub: row.code ?? row.phone ?? null,
        })
      }
    })())
  }

  if (contractIds.length > 0) {
    tasks.push((async () => {
      const { data } = await client
        .from('contracts')
        .select('id, contract_code, tenants(full_name)')
        .in('id', contractIds)
      for (const row of (data ?? []) as Array<{
        id: string
        contract_code: string
        tenants: { full_name: string } | { full_name: string }[] | null
      }>) {
        const t = Array.isArray(row.tenants) ? row.tenants[0] : row.tenants
        result.set(key('contract', row.id), {
          label: row.contract_code,
          sub: t?.full_name ?? null,
        })
      }
    })())
  }

  const simpleEntityQueries: Array<{
    type: string
    table: string
    select: string
    label: (row: Record<string, unknown>) => string | null
    sub?: (row: Record<string, unknown>) => string | null
  }> = [
    { type: 'building_expense', table: 'building_expenses', select: 'id, category, note', label: row => pickString(row, ['note', 'category']), sub: row => pickString(row, ['category']) },
    { type: 'building_fixed_cost', table: 'building_fixed_costs', select: 'id, category, note', label: row => pickString(row, ['note', 'category']), sub: row => pickString(row, ['category']) },
    { type: 'recurring_expense', table: 'recurring_expenses', select: 'id, name, category', label: row => pickString(row, ['name']), sub: row => pickString(row, ['category']) },
    { type: 'prepaid_expense', table: 'prepaid_expenses', select: 'id, name, category', label: row => pickString(row, ['name']), sub: row => pickString(row, ['category']) },
    { type: 'shared_expense', table: 'shared_expenses', select: 'id, name, category', label: row => pickString(row, ['name']), sub: row => pickString(row, ['category']) },
    { type: 'support_request', table: 'tenant_support_requests', select: 'id, title, status', label: row => pickString(row, ['title']), sub: row => pickString(row, ['status']) },
    { type: 'contract_payment', table: 'contract_payments', select: 'id, payment_type, note', label: row => pickString(row, ['note', 'payment_type']), sub: row => pickString(row, ['payment_type']) },
    { type: 'service_catalog_item', table: 'service_catalog', select: 'id, name, code', label: row => pickString(row, ['name']), sub: row => pickString(row, ['code']) },
    {
      type: 'reserve_fund_rate', table: 'building_reserve_fund_rates', select: 'id, reserve_rate_percent',
      label: row => row.reserve_rate_percent != null ? `${row.reserve_rate_percent}%` : null,
    },
    {
      type: 'operations_report_period', table: 'operations_report_periods', select: 'id, period_year, period_month, status',
      label: row => row.period_year && row.period_month ? `${String(row.period_month).padStart(2, '0')}/${row.period_year}` : null,
      sub: row => pickString(row, ['status']),
    },
  ]

  for (const config of simpleEntityQueries) {
    const ids = [...(buckets.get(config.type) ?? [])]
    if (ids.length === 0) continue
    tasks.push((async () => {
      const queryClient = client as unknown as {
        from: (table: string) => { select: (columns: string) => { in: (column: string, values: string[]) => Promise<{ data: Record<string, unknown>[] | null }> } }
      }
      const { data } = await queryClient.from(config.table).select(config.select).in('id', ids)
      for (const row of data ?? []) {
        const id = typeof row.id === 'string' ? row.id : null
        if (!id) continue
        result.set(key(config.type, id), { label: config.label(row), sub: config.sub?.(row) ?? null })
      }
    })())
  }

  const joinedEntityQueries: Array<{ type: string, table: string, select: string }> = [
    { type: 'building_service', table: 'building_services', select: 'id, service_catalog(name, code)' },
    { type: 'contract_service', table: 'contract_services', select: 'id, service_catalog(name, code)' },
    { type: 'contract_occupant', table: 'contract_occupants', select: 'id, role, tenants(full_name)' },
    { type: 'reserve_fund', table: 'reserve_funds', select: 'id, buildings(name)' },
  ]
  for (const config of joinedEntityQueries) {
    const ids = [...(buckets.get(config.type) ?? [])]
    if (ids.length === 0) continue
    tasks.push((async () => {
      const queryClient = client as unknown as {
        from: (table: string) => { select: (columns: string) => { in: (column: string, values: string[]) => Promise<{ data: Record<string, unknown>[] | null }> } }
      }
      const { data } = await queryClient.from(config.table).select(config.select).in('id', ids)
      for (const row of data ?? []) {
        const id = typeof row.id === 'string' ? row.id : null
        if (!id) continue
        const relation = (row.service_catalog ?? row.tenants ?? row.buildings) as Record<string, unknown> | Record<string, unknown>[] | null
        const related = Array.isArray(relation) ? relation[0] : relation
        result.set(key(config.type, id), {
          label: pickString(related, ['name', 'full_name', 'code']),
          sub: pickString(row, ['role']),
        })
      }
    })())
  }

  const userIds = [...(buckets.get('user') ?? [])]
  if (userIds.length > 0) {
    tasks.push((async () => {
      await Promise.all(userIds.map(async (id) => {
        try {
          const { data, error } = await client.auth.admin.getUserById(id)
          if (error || !data?.user) return
          result.set(key('user', id), {
            label: userDisplayName(data.user) ?? data.user.email ?? null,
            sub: data.user.email ?? null,
          })
        }
        catch {
          // User may have been deleted; fall back to the audit snapshot label.
        }
      }))
    })())
  }

  await Promise.all(tasks)
  return result
}

export async function enrichAuditEvents(event: H3Event, events: AuditEvent[]): Promise<AuditEvent[]> {
  if (events.length === 0) return events

  const actorIds = new Set<string>()
  const entityBuckets = new Map<string, Set<string>>()
  for (const evt of events) {
    if (evt.actorId) actorIds.add(evt.actorId)
    // Snapshots are immutable and remain available after an entity is deleted.
    // Only hit live entity tables when the event does not already carry a
    // usable display label.
    if (evt.entityId && !fallbackLabel(evt).label) {
      const bucket = entityBuckets.get(evt.entityType) ?? new Set<string>()
      bucket.add(evt.entityId)
      entityBuckets.set(evt.entityType, bucket)
    }
  }

  const [actors, entities] = await Promise.all([
    loadActors(event, [...actorIds]),
    loadEntities(event, entityBuckets),
  ])

  return events.map((evt) => {
    const actor = evt.actorId ? actors.get(evt.actorId) : null
    let entity: EntityLabel | null = null
    if (evt.entityId) {
      entity = entities.get(`${evt.entityType}:${evt.entityId}`) ?? null
    }
    if (!entity || !entity.label) {
      const fb = fallbackLabel(evt)
      entity = {
        label: entity?.label ?? fb.label,
        sub: entity?.sub ?? fb.sub,
      }
    }
    return {
      ...evt,
      actorName: actor?.name ?? null,
      actorEmail: actor?.email ?? null,
      entityLabel: entity.label,
      entitySubLabel: entity.sub,
    }
  })
}
