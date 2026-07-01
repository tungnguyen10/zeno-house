<script setup lang="ts">
import type { ContractWithDetails } from '~/types/contracts'
import type { ContractBulkAction, ContractBulkActionResult } from '~/composables/contracts/useContractBulkActions'

const props = defineProps<{
  selectedIds: string[]
  contracts: ContractWithDetails[]
  runAction: (action: ContractBulkAction, opts?: { reason?: string }) => Promise<ContractBulkActionResult>
  isRunning?: boolean
}>()

const emit = defineEmits<{
  clear: []
  done: [result: ContractBulkActionResult, action: ContractBulkAction]
}>()

const selectedCount = computed(() => props.selectedIds.length)
const selectedContracts = computed(() => {
  const map = new Map(props.contracts.map(contract => [contract.id, contract]))
  return props.selectedIds.map(id => map.get(id)).filter((contract): contract is ContractWithDetails => !!contract)
})
const previewNames = computed(() =>
  selectedContracts.value.slice(0, 10).map(contract => `${contract.contractCode} - Phòng ${contract.room.roomNumber}`),
)
const extraCount = computed(() => Math.max(0, selectedContracts.value.length - 10))

const pendingAction = ref<ContractBulkAction | null>(null)
const confirmOpen = ref(false)
const deleteAck = ref(false)
const reason = ref('')

const actionLabels: Record<ContractBulkAction, string> = {
  terminate: 'Kết thúc',
  delete: 'Xoá nhiều',
}

const actionDescriptions: Record<ContractBulkAction, string> = {
  terminate: 'Các hợp đồng được chọn sẽ chuyển sang trạng thái đã chấm dứt.',
  delete: 'Chỉ xoá được hợp đồng không hoạt động và chưa có dữ liệu hoá đơn, thanh toán, chỉ số ngoài bàn giao.',
}

function open(action: ContractBulkAction) {
  pendingAction.value = action
  deleteAck.value = false
  reason.value = ''
  confirmOpen.value = true
}

function cancel() {
  confirmOpen.value = false
  pendingAction.value = null
}

async function confirm() {
  if (!pendingAction.value) return
  if (pendingAction.value === 'delete' && !deleteAck.value) return
  const action = pendingAction.value
  const result = await props.runAction(action, { reason: reason.value.trim() || undefined })
  confirmOpen.value = false
  pendingAction.value = null
  emit('done', result, action)
}
</script>

<template>
  <div
    role="region"
    aria-label="Thao tác hàng loạt hợp đồng"
    class="sticky bottom-3 z-30 flex flex-col gap-3 rounded-xl border border-dark-border bg-dark-surface/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between"
  >
    <div class="flex items-center gap-3">
      <UiBadge variant="accent">{{ selectedCount }} đã chọn</UiBadge>
      <UiButton variant="ghost" size="sm" @click="emit('clear')">Bỏ chọn</UiButton>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <UiButton variant="secondary" size="sm" :disabled="!!isRunning || selectedCount === 0" @click="open('terminate')">
        Kết thúc
      </UiButton>
      <UiButton variant="danger" size="sm" :disabled="!!isRunning || selectedCount === 0" @click="open('delete')">
        Xoá nhiều
      </UiButton>
    </div>

    <UiConfirmModal
      :open="confirmOpen"
      :title="pendingAction ? `${actionLabels[pendingAction]} ${selectedCount} hợp đồng` : ''"
      :message="pendingAction ? actionDescriptions[pendingAction] : ''"
      :confirm-label="pendingAction ? actionLabels[pendingAction] : 'Xác nhận'"
      :loading="!!isRunning"
      @cancel="cancel"
      @confirm="confirm"
    >
      <div class="space-y-3">
        <p class="text-sm text-muted">{{ pendingAction ? actionDescriptions[pendingAction] : '' }}</p>
        <ul class="space-y-1 text-sm text-white">
          <li v-for="name in previewNames" :key="name" class="truncate">- {{ name }}</li>
          <li v-if="extraCount > 0" class="text-muted">...và {{ extraCount }} hợp đồng khác</li>
        </ul>
        <UiTextarea
          v-if="pendingAction === 'terminate'"
          v-model="reason"
          label="Lý do"
          :rows="3"
          placeholder="Ví dụ: khách trả phòng trước hạn"
        />
        <UiCheckbox
          v-if="pendingAction === 'delete'"
          v-model="deleteAck"
          label="Tôi hiểu thao tác này không thể hoàn tác và chỉ áp dụng cho hợp đồng không có dữ liệu hoá đơn."
          label-class="!text-muted"
        />
      </div>
    </UiConfirmModal>
  </div>
</template>
