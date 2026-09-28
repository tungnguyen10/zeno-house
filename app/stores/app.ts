import { defineStore } from 'pinia'
import { useStorage } from '@vueuse/core'

/**
 * App-level UI state. Desktop icon-rail collapse, persisted across sessions.
 * Mobile navigation lives in the bottom tab bar, not this store.
 */
export const useAppStore = defineStore('app', () => {
  const sidebarCollapsed = useStorage('zeno.sidebar-collapsed', false)

  function toggleCollapsed() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  return {
    sidebarCollapsed,
    toggleCollapsed,
  }
})
