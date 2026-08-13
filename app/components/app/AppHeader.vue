<script setup lang="ts">
const emit = defineEmits<{
  (e: 'toggleSidebar'): void
}>()

const { resolvedTheme, toggleTheme } = useDashboardTheme()
const themeActionLabel = computed(() => (
  resolvedTheme.value === 'dark'
    ? 'Chuyển sang giao diện sáng'
    : 'Chuyển sang giao diện tối'
))
</script>

<template>
  <header
    class="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-ui-border bg-ui-chrome/95 px-4 backdrop-blur sm:px-6 lg:absolute lg:right-6 lg:top-4 lg:h-auto lg:border-0 lg:bg-transparent lg:px-0 lg:backdrop-blur-none lg:pointer-events-none"
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
      <UiButton
        variant="ghost"
        icon-only
        data-dashboard-theme-toggle
        class="min-h-11 min-w-11 lg:min-h-9 lg:min-w-9"
        :aria-label="themeActionLabel"
        :title="themeActionLabel"
        @click="toggleTheme"
      >
        <IconSun v-if="resolvedTheme === 'dark'" class="h-5 w-5" aria-hidden="true" />
        <IconMoon v-else class="h-5 w-5" aria-hidden="true" />
      </UiButton>
      <AppUserMenu />
    </div>
  </header>
</template>
