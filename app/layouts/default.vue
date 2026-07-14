<script setup lang="ts">
import clsx from 'clsx'

const appStore = useAppStore()
const { sidebarOpen } = storeToRefs(appStore)

const overlayClass = computed(() =>
  clsx(
    'fixed inset-0 z-20 bg-black/40 lg:hidden transition-opacity duration-200',
    sidebarOpen.value ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
  )
)

const sidebarClass = computed(() =>
  clsx(
    // Base: fixed on mobile, static on desktop
    'fixed inset-y-0 left-0 z-30 transition-transform duration-200',
    'lg:static lg:z-auto lg:!translate-x-0',
    // Mobile: slide in/out
    sidebarOpen.value ? 'translate-x-0' : '-translate-x-full',
  )
)
</script>

<template>
  <div class="flex h-screen bg-dark overflow-hidden">
    <!-- Sidebar overlay — mobile only -->
    <div
      :class="overlayClass"
      aria-hidden="true"
      @click="appStore.closeSidebar()"
    />

    <!-- Sidebar -->
    <AppSidebar
      :class="sidebarClass"
      @close="appStore.closeSidebar()"
    />

    <!-- Main area -->
    <div class="flex flex-1 flex-col min-w-0 overflow-hidden">
      <AppHeader @toggle-sidebar="appStore.toggleSidebar()" />

      <!-- Content -->
      <main class="flex-1 overflow-y-auto p-6 bg-dark">
        <slot />
      </main>
    </div>
    <AppAiDevChat />
    <UiToastHost />
  </div>
</template>
