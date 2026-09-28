<script setup lang="ts">
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
</script>

<template>
  <div class="flex h-screen bg-ui-canvas overflow-hidden">
    <AppSidebar />

    <!-- Main area -->
    <div class="relative flex min-w-0 flex-1 flex-col overflow-hidden">
      <AppHeader>
        <template v-if="dashboardSummaryErrorCode !== 'FORBIDDEN'" #status>
          <DashboardOperationsPopover
            :items="dashboardSummary?.pendingOperations ?? []"
            :loading="isDashboardSummaryLoading"
            :error="dashboardSummaryError"
            @refresh="refreshDashboardSummary"
          />
        </template>
      </AppHeader>

      <!-- Content — bottom padding on mobile clears the fixed tab bar. -->
      <main
        id="main-content"
        class="flex-1 overflow-y-auto bg-ui-canvas p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:p-6 lg:pb-6"
      >
        <slot />
      </main>
    </div>
    <AppTabBar />
    <AppAiDevChat />
    <UiToastHost />
  </div>
</template>
