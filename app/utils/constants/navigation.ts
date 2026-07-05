import type { UserRole } from '~/utils/constants/roles'

export interface NavItem {
  key: string
  label: string
  to: string
  icon: string
  adminOnly?: boolean
  /** Roles allowed to see this item. When omitted, visible to all authenticated roles. */
  roles?: UserRole[]
}

export const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', to: '/', icon: 'IconChart' },
  { key: 'buildings', label: 'Tòa nhà', to: '/buildings', icon: 'IconBuilding' },
  { key: 'rooms', label: 'Phòng', to: '/rooms', icon: 'IconDoor' },
  { key: 'tenants', label: 'Khách thuê', to: '/tenants', icon: 'IconUsers' },
  { key: 'contracts', label: 'Hợp đồng', to: '/contracts', icon: 'IconDocumentText' },
  { key: 'invoices', label: 'Hoá đơn', to: '/invoices', icon: 'IconDocument' },
  { key: 'billing', label: 'Vận hành', to: '/billing', icon: 'IconBriefcase' },
  { key: 'operations-report', label: 'Báo cáo vận hành', to: '/operations-report', icon: 'IconChart' },
  { key: 'shared-expenses', label: 'Chi phí dùng chung', to: '/shared-expenses', icon: 'IconLayers', roles: ['admin', 'owner'] },
  // User management is available to admin (global) and owner (scoped), not manager.
  { key: 'settings', label: 'Settings', to: '/settings/managers', icon: 'IconSettings', roles: ['admin', 'owner'] },
  { key: 'history', label: 'Audit Log', to: '/settings/history', icon: 'IconClock', adminOnly: true },
] satisfies NavItem[]

/**
 * Whether a nav item is visible to a user. Server routes remain authoritative;
 * this only controls sidebar presentation.
 */
export function isNavItemVisible(
  item: NavItem,
  ctx: { isAdmin: boolean; role: UserRole | null },
): boolean {
  if (item.adminOnly && !ctx.isAdmin) return false
  if (item.roles && !(ctx.role && item.roles.includes(ctx.role))) return false
  return true
}
