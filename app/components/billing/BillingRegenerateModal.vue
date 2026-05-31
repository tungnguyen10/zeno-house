<script setup lang="ts">
defineProps<{
  paidCount: number
  isOpen: boolean
}>()

defineEmits<{
  (e: 'close'): void
  (e: 'confirm-mark-unpaid'): void
}>()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      @click.self="$emit('close')"
    >
      <div class="bg-dark-surface border border-dark-border rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
        <h3 class="text-base font-semibold text-white mb-2">Không thể tạo lại hóa đơn</h3>
        <p class="text-sm text-muted mb-4">
          Có <span class="text-warning font-medium">{{ paidCount }} phòng</span> đã thanh toán trong kỳ này.
          Vui lòng đánh dấu chưa thanh toán trước khi tạo lại hóa đơn.
        </p>
        <div class="flex items-center justify-end gap-3">
          <button
            class="px-4 py-2 text-sm text-muted hover:text-white transition-colors"
            @click="$emit('close')"
          >
            Hủy
          </button>
          <button
            class="px-4 py-2 bg-warning/10 text-warning text-sm font-medium rounded-md hover:bg-warning/20 transition-colors"
            @click="$emit('confirm-mark-unpaid')"
          >
            Đánh dấu chưa TT và tạo lại
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
