<script setup lang="ts">
const uiStore = useUiStore();
</script>

<template>
  <header
    class="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-gray-200 bg-white px-4 dark:border-gray-700 dark:bg-gray-900 sm:px-6"
  >
    <UButton
      class="md:hidden"
      variant="ghost"
      color="neutral"
      aria-label="Open menu"
      @click="uiStore.toggleSidebar()"
    >
      <IconMenu class="size-5" />
    </UButton>

    <div class="flex flex-1 items-center">
      <LayoutBreadcrumb />
    </div>

    <div class="flex items-center gap-2">
      <LayoutNotificationBell />
      <LayoutLanguageSwitcher />
      <LayoutUserDropdown />
    </div>
  </header>
</template>
