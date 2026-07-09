<script setup lang="ts">
import type { Tenant } from '~/types/tenants'
import type { TenantBulkAction, TenantBulkResult } from '~/composables/tenants/useTenantBulkActions'

const props = defineProps<{
  selectedIds: string[]
  tenants: Tenant[]
  runAction: (action: TenantBulkAction, opts?: { reason?: string }) => Promise<TenantBulkResult>
  isRunning?: boolean
}>()

const emit = defineEmits<{
  'clear': []
  'done': [result: TenantBulkResult, action: TenantBulkAction]
}>()

const selectedCount = computed(() => props.selectedIds.length)

const selectedTenants = computed(() => {
  const map = new Map(props.tenants.map(t => [t.id, t]))
  return props.selectedIds.map(id => map.get(id)).filter((t): t is Tenant => !!t)
})

const previewNames = computed(() => selectedTenants.value.slice(0, 10).map(t => t.fullName))
const extraCount = computed(() => Math.max(0, selectedTenants.value.length - 10))

const pendingAction = ref<TenantBulkAction | null>(null)
const confirmOpen = ref(false)
const deleteAck = ref(false)
const reason = ref('')
const reasonError = ref('')

function open(action: TenantBulkAction) {
  pendingAction.value = action
  deleteAck.value = false
  reason.value = ''
  reasonError.value = ''
  confirmOpen.value = true
}

function cancel() {
  confirmOpen.value = false
  pendingAction.value = null
  reasonError.value = ''
}

const actionLabels: Record<TenantBulkAction, string> = {
  archive: 'Lưu trữ',
  activate: 'Đánh dấu hoạt động',
  delete: 'Xoá vĩnh viễn',
}

const actionDescriptions: Record<TenantBulkAction, string> = {
  archive: 'Khách thuê sẽ chuyển sang trạng thái lưu trữ.',
  activate: 'Khách thuê sẽ chuyển sang trạng thái đang hoạt động.',
  delete: 'Hành động này không thể hoàn tác. Chỉ xoá được khách thuê không còn hợp đồng/đồng cư đang hoạt động.',
}

async function confirm() {
  if (!pendingAction.value) return
  if (pendingAction.value === 'delete') {
    const value = reason.value.trim()
    if (!deleteAck.value) return
    if (!value) {
      reasonError.value = 'Lý do xoá là bắt buộc.'
      return
    }
    reasonError.value = ''
  }

  const action = pendingAction.value
  const result = await props.runAction(action, {
    reason: action === 'delete' ? reason.value.trim() : undefined,
  })
  confirmOpen.value = false
  pendingAction.value = null
  emit('done', result, action)
}
</script>

<template>
  <div
    role="region"
    aria-label="Thao tác hàng loạt"
    class="sticky bottom-3 z-30 flex flex-col gap-3 rounded-xl border border-dark-border bg-dark-surface/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between"
  >
    <div class="flex items-center gap-3">
      <UiBadge variant="accent">{{ selectedCount }} đã chọn</UiBadge>
      <UiButton variant="ghost" size="sm" @click="emit('clear')">Bỏ chọn</UiButton>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <UiButton variant="secondary" size="sm" :disabled="!!isRunning || selectedCount === 0" @click="open('activate')">
        Đánh dấu hoạt động
      </UiButton>
      <UiButton variant="secondary" size="sm" :disabled="!!isRunning || selectedCount === 0" @click="open('archive')">
        Lưu trữ
      </UiButton>
      <UiButton variant="danger" size="sm" :disabled="!!isRunning || selectedCount === 0" @click="open('delete')">
        Xoá nhiều
      </UiButton>
    </div>

    <UiConfirmModal
      :open="confirmOpen"
      :title="pendingAction ? `${actionLabels[pendingAction]} ${selectedCount} khách thuê` : ''"
      :message="pendingAction ? actionDescriptions[pendingAction] : ''"
      :confirm-label="pendingAction ? actionLabels[pendingAction] : 'Xác nhận'"
      :loading="!!isRunning"
      @cancel="cancel"
      @confirm="confirm"
    >
      <div class="space-y-3">
        <p class="text-sm text-muted">{{ pendingAction ? actionDescriptions[pendingAction] : '' }}</p>
        <ul class="space-y-1 text-sm text-white">
          <li v-for="name in previewNames" :key="name" class="truncate">• {{ name }}</li>
          <li v-if="extraCount > 0" class="text-muted">…và {{ extraCount }} khách thuê khác</li>
        </ul>
        <UiCheckbox
          v-if="pendingAction === 'delete'"
          v-model="deleteAck"
          label="Tôi hiểu thao tác này không thể hoàn tác."
          label-class="!text-muted"
        />
        <UiTextarea
          v-if="pendingAction === 'delete'"
          v-model="reason"
          label="Lý do xoá"
          :rows="3"
          placeholder="Ví dụ: nhập trùng hồ sơ do thao tác nhầm"
          :error="reasonError"
          @update:model-value="reasonError = ''"
        />
      </div>
    </UiConfirmModal>
  </div>
</template>
