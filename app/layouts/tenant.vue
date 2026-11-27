<script setup lang="ts">
// Tenant portal shell — responsive app frame. On mobile it renders a native-like
// stack (sticky header + fixed bottom tab bar). On web (lg+) it becomes a
// centered app with a left navigation rail and a comfortable reading column.
// It deliberately renders NONE of the internal admin shell.
const { resolvedTheme, initialize } = usePortalTheme()
const route = useRoute()
const mainRef = ref<HTMLElement | null>(null)

// The layout survives page changes. Watch the committed path, not navigation
// attempts, so cancelled form guards and data refreshes keep their position.
watch(() => route.path, () => {
  if (mainRef.value) mainRef.value.scrollTop = 0
}, { flush: 'post' })

// Branded loading splash: shown on every portal entry until the shared bootstrap
// fetch resolves. Consuming the fetch here dedupes with pages via its cache key.
const { status, refresh } = usePortalBootstrap()
const minDelayElapsed = ref(false)
const initialResolved = ref(status.value === 'success' || status.value === 'error')
watch(status, value => {
  if (value === 'success' || value === 'error') initialResolved.value = true
})
const showSplash = computed(() => !initialResolved.value || !minDelayElapsed.value)
const { online, reconnected } = usePortalConnection()
const viewport = usePortalViewport()
const viewportStyle = computed(() => viewport.height.value ? { height: `${viewport.height.value}px`, minHeight: '0' } : undefined)
usePortalRefreshOnReturn(refresh, usePortalSessionKey('shell-return'))
let splashTimer: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  initialize()
  splashTimer = setTimeout(() => { minDelayElapsed.value = true }, 300)
})
onBeforeUnmount(() => { if (splashTimer) clearTimeout(splashTimer) })
</script>

<template>
  <div class="portal-shell flex h-[100dvh] justify-center overflow-hidden font-inter" :data-theme="resolvedTheme" :style="viewportStyle">
    <div class="flex h-full w-full max-w-7xl overflow-hidden bg-[color:var(--portal-bg)] lg:border-x lg:border-border-light lg:shadow-[var(--portal-elevation-raised)]">
      <PortalSidebar />
      <div class="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <PortalHeader />
        <div v-if="!online || reconnected" role="status" aria-live="polite" class="shrink-0 border-b border-border-light bg-smoke-blue px-4 py-2 portal-type-caption text-title">
          <template v-if="!online">Đang ngoại tuyến. Thông tin có thể chưa mới; cần kết nối để gửi yêu cầu hoặc kiểm tra thanh toán.</template>
          <template v-else>Đã có kết nối. Đang kiểm tra lại thông tin mới nhất.</template>
        </div>
        <main id="main-content" ref="mainRef" class="relative flex-1 overflow-y-auto overscroll-contain">
          <div class="mx-auto w-full max-w-5xl">
            <slot />
          </div>
        </main>
        <PortalTabBar />
      </div>
    </div>
    <PortalToastHost />
    <!-- Stable, portal-scoped mount point for overlays (bottom sheets). Lives in
         the layout so it survives page transitions, and sits inside
         `.portal-shell` so teleported overlays inherit the portal tokens. -->
    <div id="portal-overlay-root" />
    <PortalSplash v-if="showSplash" />
  </div>
</template>
