<script setup lang="ts">
import clsx from 'clsx'

const appStore = useAppStore()
const { sidebarOpen } = storeToRefs(appStore)
const { initialize: initializeDashboardTheme, dispose: disposeDashboardTheme } = useDashboardTheme()
const {
  summary: dashboardSummary,
  isLoading: isDashboardSummaryLoading,
  error: dashboardSummaryError,
  errorCode: dashboardSummaryErrorCode,
  refresh: refreshDashboardSummary,
} = useDashboardSummary()

initializeDashboardTheme()
onBeforeUnmount(disposeDashboardTheme)

const overlayClass = computed(() =>
  clsx(
    'fixed inset-0 z-20 bg-ui-overlay/40 lg:hidden transition-opacity duration-200',
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
  <div class="flex h-screen bg-ui-canvas overflow-hidden">
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
    <div class="relative flex min-w-0 flex-1 flex-col overflow-hidden">
      <AppHeader @toggle-sidebar="appStore.toggleSidebar()">
        <template v-if="dashboardSummaryErrorCode !== 'FORBIDDEN'" #status>
          <DashboardOperationsPopover
            :items="dashboardSummary?.pendingOperations ?? []"
            :loading="isDashboardSummaryLoading"
            :error="dashboardSummaryError"
            @refresh="refreshDashboardSummary"
          />
        </template>
      </AppHeader>

      <!-- Content -->
      <main id="main-content" class="flex-1 overflow-y-auto bg-ui-canvas p-4 sm:p-6">
        <slot />
      </main>
    </div>
    <AppAiDevChat />
    <UiToastHost />
  </div>
</template>
