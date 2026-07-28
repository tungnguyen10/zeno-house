<script setup lang="ts">
const { chrome } = usePortalChrome()
const { resolvedTheme, toggleTheme } = usePortalTheme()
const router = useRouter()

const themeActionLabel = computed(() => (
  resolvedTheme.value === 'dark'
    ? 'Chuyển sang giao diện sáng'
    : 'Chuyển sang giao diện tối'
))

function onBack() {
  if (chrome.value.back) {
    void navigateTo(chrome.value.back)
    return
  }
  router.back()
}
</script>

<template>
  <header class="portal-safe-top portal-safe-x z-30 shrink-0 border-b border-[color:var(--portal-border)] bg-[color:var(--portal-chrome)]">
    <div class="flex h-16 items-center gap-1 px-4">
      <button
        v-if="chrome.back"
        type="button"
        class="flex h-11 w-11 items-center justify-center rounded-full text-[color:var(--portal-chrome-ink)] transition-colors hover:bg-[color:var(--portal-chrome-active)] active:bg-[color:var(--portal-chrome-active)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme/40"
        aria-label="Quay lại"
        @click="onBack"
      >
        <IconArrowLeft class="h-5 w-5" aria-hidden="true" />
      </button>
      <NuxtLink
        v-else
        to="/portal"
        class="-ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[color:var(--portal-chrome-ink)] transition-colors hover:bg-[color:var(--portal-chrome-active)] active:bg-[color:var(--portal-chrome-active)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme/40 lg:hidden"
        aria-label="Zeno House — trang chủ"
      >
        <IconLogoMini class="h-7 w-auto" aria-hidden="true" />
      </NuxtLink>
      <h1 class="portal-type-heading flex-1 truncate px-1 text-[color:var(--portal-chrome-ink)]">
        {{ chrome.title }}
      </h1>
      <button
        type="button"
        class="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-[color:var(--portal-chrome-ink)] transition-colors hover:bg-[color:var(--portal-chrome-active)] active:bg-[color:var(--portal-chrome-active)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme/40"
        :aria-label="themeActionLabel"
        @click="toggleTheme"
      >
        <IconSun v-if="resolvedTheme === 'dark'" class="h-5 w-5" aria-hidden="true" />
        <IconMoon v-else class="h-5 w-5" aria-hidden="true" />
      </button>
      <!-- Single primary action target; pages teleport their action here. -->
      <div id="portal-header-action" class="flex items-center gap-1" />
    </div>
  </header>
</template>
