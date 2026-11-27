import type { UserRole } from '~/utils/constants/roles'

export const NAV_SECTIONS = [
  { key: 'primary', label: null },
  { key: 'rental', label: 'Tài sản & cho thuê' },
  { key: 'finance', label: 'Tài chính & vận hành' },
  // Single "Cài đặt" entry point — no section header needed, same as "primary".
  { key: 'administration', label: null },
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
  /** Path prefix used to decide the active state, when it's broader than `to` (e.g. a group entry covering several sub-pages). */
  activeMatch?: string
}

export const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', to: '/dashboard', icon: 'IconHome', section: 'primary' },
  { key: 'buildings', label: 'Tòa nhà', to: '/dashboard/buildings', icon: 'IconBuilding', section: 'rental' },
  { key: 'rooms', label: 'Phòng', to: '/dashboard/rooms', icon: 'IconDoor', section: 'rental' },
  { key: 'tenants', label: 'Khách thuê', to: '/dashboard/tenants', icon: 'IconUsers', section: 'rental' },
  { key: 'tenant-support-requests', label: 'Yêu cầu người thuê', to: '/dashboard/tenant-support-requests', icon: 'IconInfoCircle', section: 'rental', roles: ['admin', 'owner', 'manager'] },
  { key: 'contracts', label: 'Hợp đồng', to: '/dashboard/contracts', icon: 'IconDocumentText', section: 'rental' },
  { key: 'billing', label: 'Vận hành tháng', to: '/dashboard/billing', icon: 'IconCalendar', section: 'finance' },
  { key: 'invoices', label: 'Hoá đơn', to: '/dashboard/invoices', icon: 'IconReceipt', section: 'finance' },
  { key: 'shared-expenses', label: 'Chi phí dùng chung', to: '/dashboard/shared-expenses', icon: 'IconLayers', section: 'finance', roles: ['admin', 'owner'] },
  { key: 'operations-report', label: 'Báo cáo vận hành', to: '/dashboard/operations-report', icon: 'IconChart', section: 'finance' },
  // Single entry point for every role; sub-pages are reached via AppSettingsNav (see SETTINGS_NAV_ITEMS).
  { key: 'settings', label: 'Cài đặt', to: '/dashboard/settings', activeMatch: '/dashboard/settings', icon: 'IconSettings', section: 'administration' },
] satisfies NavItem[]

export const SETTINGS_NAV_GROUPS = [
  { key: 'personal', label: 'Cá nhân' },
  { key: 'administration', label: 'Quản trị' },
  { key: 'buildings', label: 'Tòa nhà' },
] as const

export type SettingsNavGroupKey = (typeof SETTINGS_NAV_GROUPS)[number]['key']

export interface SettingsNavItem {
  key: string
  label: string
  to: string
  group: SettingsNavGroupKey
  adminOnly?: boolean
  roles?: UserRole[]
}

/** Items of the Settings area (`AppSettingsNav`); page middleware stays authoritative. */
export const SETTINGS_NAV_ITEMS: SettingsNavItem[] = [
  { key: 'profile', label: 'Hồ sơ', to: '/dashboard/settings/profile', group: 'personal' },
  { key: 'security', label: 'Bảo mật', to: '/dashboard/settings/security', group: 'personal' },
  { key: 'users', label: 'Người dùng', to: '/dashboard/settings/managers', group: 'administration', roles: ['admin', 'owner'] },
  { key: 'tenant-accounts', label: 'Tài khoản người thuê', to: '/dashboard/settings/tenant-accounts', group: 'administration', roles: ['admin', 'owner'] },
  { key: 'access-requests', label: 'Yêu cầu truy cập', to: '/dashboard/settings/access-requests', group: 'administration', adminOnly: true },
  { key: 'building-visibility', label: 'Hiển thị tòa nhà', to: '/dashboard/settings/buildings', group: 'administration', adminOnly: true },
  { key: 'history', label: 'Nhật ký hoạt động', to: '/dashboard/settings/history', group: 'administration', adminOnly: true },
  { key: 'building-settings', label: 'Cài đặt tòa nhà', to: '/dashboard/settings/building-settings', group: 'buildings' },
]

export function getSettingsNavGroups(ctx: { isAdmin: boolean; role: UserRole | null }) {
  const items = SETTINGS_NAV_ITEMS.filter(item => isNavItemVisible(item, ctx))
  return SETTINGS_NAV_GROUPS
    .map(group => ({ key: group.key, label: group.label, items: items.filter(item => item.group === group.key) }))
    .filter(group => group.items.length > 0)
}

/**
 * Whether a nav item is visible to a user. Server routes remain authoritative;
 * this only controls sidebar presentation.
 */
export function isNavItemVisible(
  item: Pick<NavItem, 'adminOnly' | 'roles'>,
  ctx: { isAdmin: boolean; role: UserRole | null },
): boolean {
  if (item.adminOnly && !ctx.isAdmin) return false
  if (item.roles && !(ctx.role && item.roles.includes(ctx.role))) return false
  return true
}

/**
 * Highest-frequency destinations surfaced directly in the mobile bottom tab
 * bar; every other item is reachable through the tab bar's "More" sheet.
 */
const MOBILE_TAB_KEYS = ['dashboard', 'billing', 'invoices', 'contracts'] as const

export function getMobileTabItems(ctx: { isAdmin: boolean; role: UserRole | null }): NavItem[] {
  const items: NavItem[] = NAV_ITEMS
  return MOBILE_TAB_KEYS
    .map(key => items.find(item => item.key === key))
    .filter((item): item is NavItem => item !== undefined && isNavItemVisible(item, ctx))
}

export function getMoreSheetSections(ctx: { isAdmin: boolean; role: UserRole | null }) {
  const tabKeys = new Set<string>(MOBILE_TAB_KEYS)
  const items: NavItem[] = NAV_ITEMS.filter(item => !tabKeys.has(item.key) && isNavItemVisible(item, ctx))

  return NAV_SECTIONS
    .map(section => ({
      ...section,
      items: items.filter(item => item.section === section.key),
    }))
    .filter(section => section.items.length > 0)
}
