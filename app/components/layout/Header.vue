<script setup lang="ts">
const uiStore = useUiStore();
</script>

<template>
  <header
    class="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-[--color-border] bg-[--color-bg-surface] px-4 sm:px-6"
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
      <ClientOnly><LayoutDarkModeToggle /></ClientOnly>
      <LayoutLanguageSwitcher />
      <LayoutUserDropdown />
    </div>
  </header>
</template>
