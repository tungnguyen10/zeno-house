import type { Component } from 'vue'

export interface NavItem {
  key: string
  label: string
  to: string
  icon: string
}

export const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', to: '/', icon: 'home' },
  { key: 'buildings', label: 'Tòa nhà', to: '/buildings', icon: 'building' },
  { key: 'rooms', label: 'Phòng', to: '/rooms', icon: 'door' },
  { key: 'tenants', label: 'Khách thuê', to: '/tenants', icon: 'users' },
  { key: 'contracts', label: 'Hợp đồng', to: '/contracts', icon: 'file-text' },
] satisfies NavItem[]
