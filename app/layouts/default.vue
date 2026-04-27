<script setup lang="ts">
const route = useRoute();
const uiStore = useUiStore();

watch(() => route.path, () => {
  uiStore.closeSidebar();
});
</script>

<template>
  <div class="flex min-h-screen bg-gray-50 dark:bg-gray-950">
    <!-- Desktop sidebar -->
    <div class="hidden md:flex md:shrink-0">
      <LayoutSidebar />
    </div>

    <!-- Mobile nav (overlay) -->
    <LayoutMobileNav />

    <!-- Main content area -->
    <div class="flex min-w-0 flex-1 flex-col">
      <LayoutHeader />

      <main class="flex-1 overflow-y-auto p-4 sm:p-6">
        <slot />
      </main>
    </div>
  </div>
</template>
