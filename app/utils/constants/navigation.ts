import type { UserRole } from '~/utils/constants/roles'

export const NAV_SECTIONS = [
  { key: 'primary', label: null },
  { key: 'rental', label: 'Tài sản & cho thuê' },
  { key: 'finance', label: 'Tài chính & vận hành' },
  { key: 'administration', label: 'Quản trị' },
] as const

export type NavSectionKey = (typeof NAV_SECTIONS)[number]['key']

export interface NavItem {
  key: string
  label: string
  to: string
  icon: string
  section: NavSectionKey
  adminOnly?: boolean
  /** Roles allowed to see this item. When omitted, visible to all authenticated roles. */
  roles?: UserRole[]
}

export const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', to: '/dashboard', icon: 'IconHome', section: 'primary' },
  { key: 'buildings', label: 'Tòa nhà', to: '/dashboard/buildings', icon: 'IconBuilding', section: 'rental' },
  { key: 'rooms', label: 'Phòng', to: '/dashboard/rooms', icon: 'IconDoor', section: 'rental' },
  { key: 'tenants', label: 'Khách thuê', to: '/dashboard/tenants', icon: 'IconUsers', section: 'rental' },
  { key: 'contracts', label: 'Hợp đồng', to: '/dashboard/contracts', icon: 'IconDocumentText', section: 'rental' },
  { key: 'billing', label: 'Vận hành tháng', to: '/dashboard/billing', icon: 'IconCalendar', section: 'finance' },
  { key: 'invoices', label: 'Hoá đơn', to: '/dashboard/invoices', icon: 'IconReceipt', section: 'finance' },
  { key: 'shared-expenses', label: 'Chi phí dùng chung', to: '/dashboard/shared-expenses', icon: 'IconLayers', section: 'finance', roles: ['admin', 'owner'] },
  { key: 'operations-report', label: 'Báo cáo vận hành', to: '/dashboard/operations-report', icon: 'IconChart', section: 'finance' },
  // User management is available to admin (global) and owner (scoped), not manager.
  { key: 'settings', label: 'Quản lý người dùng', to: '/dashboard/settings/managers', icon: 'IconSettings', section: 'administration', roles: ['admin', 'owner'] },
  { key: 'tenant-accounts', label: 'Tài khoản người thuê', to: '/dashboard/settings/tenant-accounts', icon: 'IconUser', section: 'administration', roles: ['admin', 'owner'] },
  { key: 'access-requests', label: 'Yêu cầu truy cập', to: '/dashboard/settings/access-requests', icon: 'IconLock', section: 'administration', adminOnly: true },
  { key: 'history', label: 'Nhật ký hoạt động', to: '/dashboard/settings/history', icon: 'IconClock', section: 'administration', adminOnly: true },
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
