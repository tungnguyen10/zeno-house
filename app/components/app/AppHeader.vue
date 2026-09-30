<script setup lang="ts">
const { resolvedTheme, toggleTheme } = useDashboardTheme()
const themeActionLabel = computed(() => (
  resolvedTheme.value === 'dark'
    ? 'Chuyển sang giao diện sáng'
    : 'Chuyển sang giao diện tối'
))

const headerBack = useAppHeaderBack()
const headerTitle = useAppHeaderTitle()
function onBack() {
  if (headerBack.value) void navigateTo(headerBack.value)
}
</script>

<template>
  <header
    class="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-ui-border bg-ui-chrome/95 px-4 backdrop-blur sm:px-6 lg:absolute lg:right-6 lg:top-4 lg:h-auto lg:border-0 lg:bg-transparent lg:px-0 lg:backdrop-blur-none lg:pointer-events-none"
  >
    <!-- Client-only: the page sets this after AppHeader has already rendered on the server. -->
    <ClientOnly>
      <button
        v-if="headerBack"
        type="button"
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ui-primary transition-colors hover:bg-ui-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent/40 lg:hidden"
        aria-label="Quay lại"
        @click="onBack"
      >
        <IconArrowLeft class="h-5 w-5" aria-hidden="true" />
      </button>
      <NuxtLink
        v-else
        to="/dashboard"
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-ui-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent/40 lg:hidden"
        aria-label="Zeno House — Trang chủ"
      >
        <IconLogoMini class="h-6 w-auto" aria-hidden="true" />
      </NuxtLink>
    </ClientOnly>

    <div class="flex-1 min-w-0 lg:hidden">
      <ClientOnly>
        <Transition
          enter-active-class="transition duration-150 ease-out"
          enter-from-class="opacity-0"
          enter-to-class="opacity-100"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <p v-if="headerTitle" class="truncate text-left text-sm font-semibold text-ui-primary">
            {{ headerTitle }}
          </p>
        </Transition>
      </ClientOnly>
    </div>

    <div data-global-actions class="pointer-events-auto flex items-center gap-1 lg:gap-2">
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
