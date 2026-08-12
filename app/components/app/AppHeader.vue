<script setup lang="ts">
const emit = defineEmits<{
  (e: 'toggleSidebar'): void
}>()
</script>

<template>
  <header
    class="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-dark-border bg-dark-card/95 px-4 backdrop-blur sm:px-6 lg:absolute lg:right-6 lg:top-4 lg:h-auto lg:border-0 lg:bg-transparent lg:px-0 lg:backdrop-blur-none lg:pointer-events-none"
  >
    <UiButton
      variant="ghost"
      icon-only
      class="lg:hidden"
      aria-label="Mở sidebar"
      @click="emit('toggleSidebar')"
    >
      <IconMenu class="h-5 w-5" aria-hidden="true" />
    </UiButton>

    <div class="flex-1 lg:hidden" />

    <div data-global-actions class="pointer-events-auto flex items-center gap-2">
      <slot name="status" />
      <AppUserMenu />
    </div>
  </header>
</template>
