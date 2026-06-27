<script setup lang="ts">
const emit = defineEmits<{
  (e: 'toggleSidebar'): void
}>()
</script>

<template>
  <header class="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 border-b border-dark-border bg-dark-card/95 px-4 backdrop-blur sm:px-6">
    <UiButton
      variant="ghost"
      icon-only
      class="lg:hidden"
      aria-label="Mở sidebar"
      @click="emit('toggleSidebar')"
    >
      <IconMenu class="h-5 w-5" aria-hidden="true" />
    </UiButton>

    <div class="flex-1" />

    <AppUserMenu />
  </header>
</template>
