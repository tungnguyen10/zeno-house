<script setup lang="ts">
defineProps<{
  selectedCount: number
  isSaving?: boolean
}>()

defineEmits<{
  (e: 'mark-paid'): void
  (e: 'mark-unpaid'): void
  (e: 'clear-selection'): void
}>()
</script>

<template>
  <div
    v-if="selectedCount > 0"
    class="flex items-center gap-4 px-4 py-2 bg-dark-surface border border-dark-border rounded-lg"
  >
    <span class="text-sm text-muted">{{ selectedCount }} phòng đã chọn</span>
    <button
      class="px-3 py-1.5 bg-success-neon/10 text-success-neon text-xs font-medium rounded hover:bg-success-neon/20 transition-colors disabled:opacity-50"
      :disabled="isSaving"
      @click="$emit('mark-paid')"
    >
      Mark paid
    </button>
    <button
      class="px-3 py-1.5 bg-warning/10 text-warning text-xs font-medium rounded hover:bg-warning/20 transition-colors disabled:opacity-50"
      :disabled="isSaving"
      @click="$emit('mark-unpaid')"
    >
      Mark unpaid
    </button>
    <button
      class="px-3 py-1.5 text-muted text-xs font-medium rounded hover:text-white transition-colors"
      @click="$emit('clear-selection')"
    >
      Bỏ chọn
    </button>
  </div>
</template>
