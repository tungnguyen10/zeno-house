<script setup lang="ts">
import type { BuildingInvoiceEmailSettings } from '~/types/invoice-email'

const props = defineProps<{
  settings: BuildingInvoiceEmailSettings | null
  canEdit: boolean
  loading: boolean
  saving: boolean
  error: string | null
}>()

const emit = defineEmits<{
  save: [enabled: boolean]
}>()

const confirmOpen = ref(false)
const enabled = computed(() => props.settings?.autoSendEnabled ?? false)
const featureAvailable = computed(() => props.settings?.featureAvailable ?? false)
const disabled = computed(() =>
  props.loading || props.saving || !props.canEdit || !featureAvailable.value,
)

function requestChange(next: boolean) {
  if (disabled.value || next === enabled.value) return
  if (next) {
    confirmOpen.value = true
    return
  }
  emit('save', false)
}

function confirmEnable() {
  confirmOpen.value = false
  emit('save', true)
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="loading" class="space-y-3" aria-label="Đang tải cấu hình gửi email">
      <UiSkeleton class="h-6 w-48" />
      <UiSkeleton class="h-12 w-full" />
    </div>

    <template v-else>
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <h3 class="text-sm font-semibold text-white">Tự động gửi khi phát hành</h3>
            <UiBadge
              :variant="!featureAvailable ? 'neutral' : enabled ? 'success' : 'warning'"
              pill
            >
              {{ !featureAvailable ? 'Chưa mở trên hệ thống' : enabled ? 'Đang bật' : 'Đang tắt' }}
            </UiBadge>
          </div>
          <p class="mt-1 max-w-2xl text-xs leading-5 text-muted">
            Chỉ áp dụng cho hoá đơn phát hành sau khi bật. Hoá đơn cũ không được gửi bù tự động.
          </p>
        </div>
        <UiToggle
          :model-value="enabled"
          :disabled="disabled"
          :aria-label="enabled ? 'Tắt tự động gửi hoá đơn' : 'Bật tự động gửi hoá đơn'"
          @update:model-value="requestChange"
        />
      </div>

      <UiAlert v-if="!featureAvailable" severity="info">
        Cấu hình được giữ ở trạng thái tắt cho đến khi quản trị viên mở chức năng toàn hệ thống.
      </UiAlert>
      <UiAlert v-else-if="!canEdit" severity="info">
        Bạn có thể xem cấu hình nhưng chỉ chủ sở hữu hoặc quản trị viên mới được thay đổi.
      </UiAlert>
      <UiAlert v-if="error" severity="danger">{{ error }}</UiAlert>
      <p v-if="saving" class="text-xs text-muted" role="status">Đang lưu thay đổi…</p>
    </template>

    <UiModal
      :open="confirmOpen"
      title="Bật gửi hoá đơn tự động?"
      size="sm"
      @close="confirmOpen = false"
    >
      <p class="text-sm leading-6 text-muted">
        Từ lần phát hành tiếp theo, hệ thống sẽ xếp hàng gửi HTML và PDF đến email liên hệ chính của khách thuê. Việc gửi email không làm gián đoạn phát hành hoá đơn.
      </p>
      <template #footer>
        <UiButton variant="secondary" :disabled="saving" @click="confirmOpen = false">Huỷ</UiButton>
        <UiButton :loading="saving" @click="confirmEnable">Bật tự động gửi</UiButton>
      </template>
    </UiModal>
  </div>
</template>
