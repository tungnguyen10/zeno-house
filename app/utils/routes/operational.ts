import { slugifyName } from '~/utils/format/slug'

export interface BuildingRouteSubject {
  id: string
  slug?: string | null
  name?: string | null
}

export interface RoomRouteSubject {
  id: string
  code?: string | null
  roomNumber?: string | null
  slug?: string | null
  building?: BuildingRouteSubject | null
}

export interface TenantRouteSubject {
  code: string
}

export interface ContractRouteSubject {
  id: string
  code?: string | null
  contractCode?: string | null
  slug?: string | null
}

export interface InvoiceRouteSubject {
  id: string
  code?: string | null
  invoiceCode?: string | null
}

export function buildingRouteSegment(building: BuildingRouteSubject): string {
  return building.slug || building.id
}

export function buildingPath(building: BuildingRouteSubject): string {
  return `/buildings/${buildingRouteSegment(building)}`
}

export function buildingEditPath(building: BuildingRouteSubject): string {
  return `${buildingPath(building)}/edit`
}

export function buildingSettingsPath(building: BuildingRouteSubject): string {
  return `${buildingPath(building)}/settings`
}

export function roomRouteSegment(room: RoomRouteSubject): string {
  return room.slug || (room.roomNumber ? slugifyName(room.roomNumber) : room.id)
}

export function roomPath(room: RoomRouteSubject): string {
  if (room.code) {
    return `/rooms/${room.code}`
  }
  if (room.building) {
    return `${buildingPath(room.building)}/rooms/${roomRouteSegment(room)}`
  }
  return `/rooms/${room.id}`
}

export function roomEditPath(room: RoomRouteSubject): string {
  return `${roomPath(room)}/edit`
}

export function billingWorkspacePath(
  building: BuildingRouteSubject,
  periodYear: number,
  periodMonth: number,
): string {
  return `/billing/${buildingRouteSegment(building)}/${periodYear}-${String(periodMonth).padStart(2, '0')}`
}

export function billingWorkspaceInvoicePath(
  building: BuildingRouteSubject,
  periodYear: number,
  periodMonth: number,
  invoiceId: string,
): string {
  return `${billingWorkspacePath(building, periodYear, periodMonth)}?invoice=${encodeURIComponent(invoiceId)}`
}

export interface PendingOperationLike {
  building: BuildingRouteSubject
  period: string
}

export function pendingOperationPath(item: PendingOperationLike): string {
  const [yearStr, monthStr] = item.period.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  return billingWorkspacePath(item.building, year, month)
}

export function contractPath(contract: ContractRouteSubject): string {
  return `/contracts/${contract.slug || contract.contractCode || contract.code || contract.id}`
}

export function invoiceRouteSegment(invoice: InvoiceRouteSubject): string {
  return invoice.invoiceCode || invoice.code || invoice.id
}

export function invoicePath(invoice: InvoiceRouteSubject): string {
  return `/billing/invoices/${invoiceRouteSegment(invoice)}`
}

export function tenantPath(tenant: TenantRouteSubject): string {
  return `/tenants/${tenant.code}`
}
