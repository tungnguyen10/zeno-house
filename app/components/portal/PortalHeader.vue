<script setup lang="ts">
const { chrome } = usePortalChrome()
const router = useRouter()

function onBack() {
  if (chrome.value.back) {
    void navigateTo(chrome.value.back)
    return
  }
  router.back()
}
</script>

<template>
  <header class="portal-safe-top portal-safe-x z-30 shrink-0 border-b border-border-light bg-white">
    <div class="flex h-16 items-center gap-1 px-4">
      <button
        v-if="chrome.back"
        type="button"
        class="flex h-11 w-11 items-center justify-center rounded-full text-title transition-colors hover:bg-smoke active:bg-smoke focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme/40"
        aria-label="Quay lại"
        @click="onBack"
      >
        <IconArrowLeft class="h-5 w-5" aria-hidden="true" />
      </button>
      <h1 class="portal-type-heading flex-1 truncate px-1 text-title">
        {{ chrome.title }}
      </h1>
      <!-- Single primary action target; pages teleport their action here. -->
      <div id="portal-header-action" class="flex items-center gap-1" />
    </div>
  </header>
</template>
