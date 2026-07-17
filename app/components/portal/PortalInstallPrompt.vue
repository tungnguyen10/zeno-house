<script setup lang="ts">
const { showInstallPrompt, showIosGuide, isIos, promptInstall, dismiss } = usePortalInstall()

// Never surface on first paint — wait a few seconds after mount.
const ready = ref(false)
const iosSheetOpen = ref(false)

onMounted(() => {
  const timer = setTimeout(() => (ready.value = true), 4000)
  onBeforeUnmount(() => clearTimeout(timer))
})

const showBanner = computed(() => ready.value && (showInstallPrompt.value || showIosGuide.value))

async function onInstall() {
  if (isIos.value) {
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
        enter-active-class="transition-all duration-300 ease-out"
        leave-active-class="transition-all duration-200 ease-in"
        enter-from-class="opacity-0 translate-y-4"
        leave-to-class="opacity-0 translate-y-4"
      >
        <div
          v-if="showBanner"
          class="portal-safe-x fixed inset-x-0 bottom-[76px] z-[70] px-4"
        >
          <div class="flex items-center gap-3 rounded-2xl border border-border-light bg-white p-3 shadow-lg">
            <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-smoke-blue text-theme">
              <IconBrand class="h-6 w-6" aria-hidden="true" />
            </span>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-title">Cài đặt ứng dụng Zeno</p>
              <p class="truncate text-xs text-body">Mở nhanh từ màn hình chính, như một app thật.</p>
            </div>
            <PortalButton size="sm" @click="onInstall">Cài đặt</PortalButton>
            <button
              type="button"
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-body transition-colors hover:bg-smoke"
              aria-label="Bỏ qua"
              @click="dismiss"
            >
              <IconX class="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>

    <PortalBottomSheet v-model="iosSheetOpen" title="Thêm vào màn hình chính">
      <ol class="space-y-4 py-2">
        <li class="flex items-start gap-3">
          <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-smoke-blue text-sm font-semibold text-theme">1</span>
          <p class="text-sm text-title">
            Nhấn nút <span class="font-semibold">Chia sẻ</span>
            <IconArrowUp class="mx-1 inline h-4 w-4 text-theme" aria-hidden="true" />
            trên thanh công cụ Safari.
          </p>
        </li>
        <li class="flex items-start gap-3">
          <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-smoke-blue text-sm font-semibold text-theme">2</span>
          <p class="text-sm text-title">
            Chọn <span class="font-semibold">Thêm vào MH chính</span> (Add to Home Screen).
          </p>
        </li>
        <li class="flex items-start gap-3">
          <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-smoke-blue text-sm font-semibold text-theme">3</span>
          <p class="text-sm text-title">
            Nhấn <span class="font-semibold">Thêm</span> để cài đặt Zeno.
          </p>
        </li>
      </ol>
      <PortalButton block class="mt-2" @click="dismiss(); iosSheetOpen = false">Đã hiểu</PortalButton>
    </PortalBottomSheet>
  </div>
</template>
