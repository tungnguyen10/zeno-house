import { defineStore } from 'pinia'
import { useStorage } from '@vueuse/core'

/**
 * App-level UI state. Sidebar has two independent dimensions:
 * - `sidebarOpen`: mobile drawer open/closed (transient, resets per session)
 * - `sidebarCollapsed`: desktop icon-rail collapse (persisted across sessions)
 */
export const useAppStore = defineStore('app', () => {
  const sidebarOpen = ref(false)
  const sidebarCollapsed = useStorage('zeno.sidebar-collapsed', false)

  function openSidebar() {
    sidebarOpen.value = true
  }

  function closeSidebar() {
    sidebarOpen.value = false
  }

  function toggleSidebar() {
    sidebarOpen.value = !sidebarOpen.value
  }

  function toggleCollapsed() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  return {
    sidebarOpen,
    sidebarCollapsed,
    openSidebar,
    closeSidebar,
    toggleSidebar,
    toggleCollapsed,
  }
})
