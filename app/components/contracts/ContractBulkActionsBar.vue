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

const pendingAction = ref<ContractBulkAction | null>(null)
const confirmOpen = ref(false)
const deleteAck = ref(false)
const reason = ref('')
const reasonError = ref('')

const actionLabels: Record<ContractBulkAction, string> = {
  terminate: 'Danh sách cần xử lý',
  delete: 'Xoá nhiều',
}

const actionDescriptions: Record<ContractBulkAction, string> = {
  terminate: 'Mở từng hợp đồng để ghi ngày trả, lý do và chỉ số cuối riêng trước khi bàn giao.',
  delete: 'Chỉ xoá được hợp đồng không hoạt động và chưa có dữ liệu hoá đơn, thanh toán, chỉ số ngoài bàn giao.',
}

function open(action: ContractBulkAction) {
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

async function confirm() {
  if (!pendingAction.value) return
  if (pendingAction.value === 'terminate') { cancel(); return }
  if (pendingAction.value === 'delete') {
    if (!deleteAck.value) return
    if (!reason.value.trim()) {
      reasonError.value = 'Lý do xoá là bắt buộc.'
      return
    }
    reasonError.value = ''
  }
  const action = pendingAction.value
  const result = await props.runAction(action, { reason: reason.value.trim() || undefined })
  confirmOpen.value = false
  pendingAction.value = null
  emit('done', result, action)
}
</script>

<template>
  <UiBulkActionsBar aria-label="Thao tác hàng loạt hợp đồng" :count="selectedCount" @clear="emit('clear')">
    <UiButton variant="secondary" size="sm" :disabled="!!isRunning || selectedCount === 0" @click="open('terminate')">
      Danh sách cần xử lý
    </UiButton>
    <UiButton variant="danger" size="sm" :disabled="!!isRunning || selectedCount === 0" @click="open('delete')">
      Xoá nhiều
    </UiButton>

    <UiConfirmModal
      :open="confirmOpen"
      :title="pendingAction ? `${actionLabels[pendingAction]} ${selectedCount} hợp đồng` : ''"
      :message="pendingAction ? actionDescriptions[pendingAction] : ''"
      :confirm-label="pendingAction === 'terminate' ? 'Đóng danh sách' : pendingAction ? actionLabels[pendingAction] : 'Xác nhận'"
      :loading="!!isRunning"
      @cancel="cancel"
      @confirm="confirm"
    >
      <div class="space-y-3">
        <p class="text-sm text-ui-muted">{{ pendingAction ? actionDescriptions[pendingAction] : '' }}</p>
        <ul class="max-h-72 space-y-1 overflow-y-auto text-sm text-ui-primary">
          <li v-for="contract in selectedContracts" :key="contract.id" class="truncate">
            <NuxtLink :to="`/dashboard/contracts/${encodeURIComponent(contract.contractCode)}#checkout`" class="text-ui-accent hover:underline focus-visible:ring-2 focus-visible:ring-ui-accent/40" @click="cancel">{{ contract.contractCode }} · Phòng {{ contract.room.roomNumber }} → Mở bàn giao</NuxtLink>
          </li>
        </ul>
        <UiCheckbox
          v-if="pendingAction === 'delete'"
          v-model="deleteAck"
          label="Tôi hiểu thao tác này không thể hoàn tác và chỉ áp dụng cho hợp đồng không có dữ liệu hoá đơn."
          label-class="!text-ui-muted"
        />
        <UiTextarea
          v-if="pendingAction === 'delete'"
          v-model="reason"
          label="Lý do xoá"
          :rows="3"
          placeholder="Ví dụ: hợp đồng được nhập sai thông tin"
          :error="reasonError"
          @update:model-value="reasonError = ''"
        />
      </div>
    </UiConfirmModal>
  </UiBulkActionsBar>
</template>
