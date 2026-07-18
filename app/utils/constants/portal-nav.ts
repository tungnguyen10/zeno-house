/**
 * Shared primary navigation for the tenant portal. The same five destinations
 * render as a bottom tab bar on mobile (`PortalTabBar`) and a vertical rail on
 * web (`PortalSidebar`), so both surfaces stay in sync from one source.
 */
export interface PortalNavItem {
  key: string
  label: string
  to: string
  icon: string
  /** Only active on an exact path match (used for the home root). */
  exact?: boolean
}

export const PORTAL_NAV_ITEMS: PortalNavItem[] = [
  { key: 'home', label: 'Trang chủ', to: '/portal', icon: 'IconHome', exact: true },
  { key: 'invoices', label: 'Hoá đơn', to: '/portal/invoices', icon: 'IconReceipt' },
  { key: 'room', label: 'Phòng', to: '/portal/room', icon: 'IconDoor' },
  { key: 'requests', label: 'Yêu cầu', to: '/portal/requests', icon: 'IconMessageCircle' },
  { key: 'account', label: 'Tài khoản', to: '/portal/profile', icon: 'IconUser' },
]

export function isPortalNavActive(item: PortalNavItem, path: string): boolean {
  if (item.exact) return path === item.to
  return path === item.to || path.startsWith(`${item.to}/`)
}
