export interface NavItem {
  key: string
  label: string
  to: string
  icon: string
}

export const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', to: '/', icon: 'IconChart' },
  { key: 'buildings', label: 'Tòa nhà', to: '/buildings', icon: 'IconBuilding' },
  { key: 'rooms', label: 'Phòng', to: '/rooms', icon: 'IconDoor' },
  { key: 'tenants', label: 'Khách thuê', to: '/tenants', icon: 'IconUsers' },
  { key: 'contracts', label: 'Hợp đồng', to: '/contracts', icon: 'IconDocumentText' },
  { key: 'billing', label: 'Vận hành', to: '/billing', icon: 'IconBriefcase' },
] satisfies NavItem[]
