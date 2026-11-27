<script setup lang="ts">
const route = useRoute()
const app = useNuxtApp()
const ready = useState<boolean>('pwa-update-ready', () => false)
const updating = useState<boolean>('pwa-updating', () => false)
const error = useState<string | null>('pwa-update-error', () => null)
const sequence = useState<number>('pwa-update-sequence', () => 0)
const dirty = useState<boolean>('portal-form-dirty', () => false)
const otherDirty = useState<boolean>('pwa-other-form-dirty', () => false)
const dismissed = ref(false)
const { resolvedTheme } = usePortalTheme()
const portal = computed(() => route.path.startsWith('/portal'))
const activeSurface = computed(() => portal.value || route.path.startsWith('/dashboard'))
const blocked = computed(() => dirty.value || otherDirty.value)
watch(() => route.path, () => { if (ready.value && !blocked.value) dismissed.value = false })
watch(ready, () => { dismissed.value = false })
watch(sequence, () => { dismissed.value = false })
</script>

<template>
  <ClientOnly>
    <Teleport to="body">
      <aside
        v-if="ready && activeSurface && !dismissed"
        class="portal-shell portal-install-host portal-safe-x fixed inset-x-0 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-[71] px-4 lg:bottom-4"
        data-pwa-update-host
        :data-theme="portal ? resolvedTheme : 'dark'"
        aria-labelledby="portal-update-title"
      >
        <div class="mx-auto max-w-lg rounded-2xl border border-border-light bg-white p-4 shadow-[var(--portal-elevation-raised)]">
          <h2 id="portal-update-title" class="portal-type-label text-title">Có phiên bản Zeno mới</h2>
          <p class="portal-type-caption mt-1 text-body">{{ blocked ? 'Hoàn tất thông tin đang nhập trước khi cập nhật.' : 'Cập nhật sẽ tải lại trang. Thông tin đã lưu được giữ nguyên.' }}</p>
          <p v-if="error" role="alert" class="portal-type-caption mt-2 text-portal-danger-ink">{{ error }}</p>
          <div class="mt-3 flex flex-wrap gap-2">
            <PortalButton size="sm" :disabled="blocked" :loading="updating" @click="app.$pwaUpdate?.apply()">Cập nhật</PortalButton>
            <PortalButton size="sm" variant="ghost" :disabled="updating" @click="dismissed = true">Để sau</PortalButton>
          </div>
        </div>
      </aside>
    </Teleport>
  </ClientOnly>
</template>
