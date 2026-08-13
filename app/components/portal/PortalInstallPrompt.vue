<script setup lang="ts">
const route = useRoute()
const authStore = useAuthStore()
const { resolvedTheme, initialize } = usePortalTheme()
const {
  showInstallPrompt,
  showIosGuide,
  isAppleMobile,
  isSafari,
  promptInstall,
  dismiss,
} = usePortalInstall()

// Never surface on first paint — wait a few seconds after mount.
const ready = ref(false)
const iosSheetOpen = ref(false)
let readyTimer: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  initialize()
  readyTimer = setTimeout(() => (ready.value = true), 4000)
})

onBeforeUnmount(() => {
  if (readyTimer) clearTimeout(readyTimer)
})

const showBanner = computed(() => (
  authStore.isAuthenticated
  && ready.value
  && (showInstallPrompt.value || showIosGuide.value)
))
const isPortalRoute = computed(() => route.path.startsWith('/portal'))
const installTheme = computed(() => isPortalRoute.value ? resolvedTheme.value : 'dark')

async function onInstall() {
  if (isAppleMobile.value) {
    iosSheetOpen.value = true
    return
  }
  const outcome = await promptInstall()
  if (outcome !== 'unavailable') dismiss()
}
</script>

<template>
  <div>
    <Teleport to="body">
      <Transition
        enter-active-class="transition-[opacity,transform] duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
        leave-active-class="transition-[opacity,transform] duration-200 [transition-timing-function:cubic-bezier(0.32,0,0.67,0)] motion-reduce:transition-none"
        enter-from-class="opacity-0 translate-y-4"
        leave-to-class="opacity-0 translate-y-4"
      >
        <div
          v-if="showBanner"
          class="portal-shell portal-install-host portal-safe-x fixed inset-x-0 z-[70] px-4"
          :class="isPortalRoute ? 'bottom-[76px]' : 'bottom-4'"
          :data-theme="installTheme"
        >
          <div class="flex items-center gap-3 rounded-2xl border border-border-light bg-white p-3 m-1.5 shadow-lg">
            <span class="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-smoke-blue text-theme sm:flex">
              <IconBrand class="h-6 w-6" aria-hidden="true" />
            </span>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-title">Cài đặt ứng dụng Zeno</p>
              <p class="hidden text-xs text-body min-[360px]:block">Mở nhanh từ màn hình chính, như một ứng dụng.</p>
            </div>
            <PortalButton size="sm" class="whitespace-nowrap" @click="onInstall">Cài đặt</PortalButton>
            <button
              type="button"
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-body hover:bg-smoke focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme/40"
              aria-label="Bỏ qua"
              @click="dismiss"
            >
              <IconX class="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>

    <PortalBottomSheet v-model="iosSheetOpen" title="Thêm vào màn hình chính" :theme="installTheme">
      <ol class="space-y-4 py-2">
        <li class="flex items-start gap-3">
          <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-smoke-blue text-sm font-semibold text-theme">1</span>
          <p class="text-sm text-title">
            Nhấn <span class="font-semibold">Chia sẻ</span>
            <IconArrowUp class="mx-1 inline h-4 w-4 text-theme" aria-hidden="true" />
            Nếu không thấy nút này, mở menu <span class="font-semibold">Thêm</span> (…) rồi chọn Chia sẻ.
          </p>
        </li>
        <li class="flex items-start gap-3">
          <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-smoke-blue text-sm font-semibold text-theme">2</span>
          <p class="text-sm text-title">
            Cuộn xuống và chọn <span class="font-semibold">Thêm vào Màn hình chính</span>.
          </p>
        </li>
        <li class="flex items-start gap-3">
          <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-smoke-blue text-sm font-semibold text-theme">3</span>
          <p class="text-sm text-title">
            Bật <span class="font-semibold">Mở dưới dạng ứng dụng web</span>.
          </p>
        </li>
        <li class="flex items-start gap-3">
          <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-smoke-blue text-sm font-semibold text-theme">4</span>
          <p class="text-sm text-title">
            Nhấn <span class="font-semibold">Thêm</span> để cài đặt Zeno.
          </p>
        </li>
      </ol>
      <p v-if="!isSafari" class="mb-4 text-xs text-body">
        Nếu không thấy lựa chọn này, hãy mở trang bằng Safari rồi thực hiện lại.
      </p>
      <PortalButton data-autofocus block class="mt-2" @click="dismiss(); iosSheetOpen = false">Đã hiểu</PortalButton>
    </PortalBottomSheet>
  </div>
</template>
