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
  { key: 'dashboard', label: 'Dashboard', to: '/dashboard', icon: 'IconChart' },
  { key: 'buildings', label: 'Tòa nhà', to: '/dashboard/buildings', icon: 'IconBuilding' },
  { key: 'rooms', label: 'Phòng', to: '/dashboard/rooms', icon: 'IconDoor' },
  { key: 'tenants', label: 'Khách thuê', to: '/dashboard/tenants', icon: 'IconUsers' },
  { key: 'contracts', label: 'Hợp đồng', to: '/dashboard/contracts', icon: 'IconDocumentText' },
  { key: 'invoices', label: 'Hoá đơn', to: '/dashboard/invoices', icon: 'IconDocument' },
  { key: 'billing', label: 'Vận hành', to: '/dashboard/billing', icon: 'IconBriefcase' },
  { key: 'operations-report', label: 'Báo cáo vận hành', to: '/dashboard/operations-report', icon: 'IconChart' },
  { key: 'shared-expenses', label: 'Chi phí dùng chung', to: '/dashboard/shared-expenses', icon: 'IconLayers', roles: ['admin', 'owner'] },
  // User management is available to admin (global) and owner (scoped), not manager.
  { key: 'settings', label: 'Settings', to: '/dashboard/settings/managers', icon: 'IconSettings', roles: ['admin', 'owner'] },
  { key: 'tenant-accounts', label: 'Tài khoản thuê', to: '/dashboard/settings/tenant-accounts', icon: 'IconUser', roles: ['admin', 'owner'] },
  { key: 'access-requests', label: 'Yêu cầu truy cập', to: '/dashboard/settings/access-requests', icon: 'IconUser', adminOnly: true },
  { key: 'history', label: 'Audit Log', to: '/dashboard/settings/history', icon: 'IconClock', adminOnly: true },
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
