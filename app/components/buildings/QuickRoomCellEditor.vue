<script setup lang="ts">
import clsx from 'clsx'
import type { PreviewField } from '~/composables/buildings/useQuickRoomPreview'

const props = withDefaults(defineProps<{
  roomNumber: string
  field: PreviewField
  value: number | null
  overridden: boolean
  disabled?: boolean
  compact?: boolean
}>(), {
  disabled: false,
  compact: false,
})

const emit = defineEmits<{
  (e: 'update', value: number | null): void
  (e: 'reset'): void
}>()

const FIELD_LABELS: Record<PreviewField, string> = { floor: 'tầng', rent: 'giá thuê', area: 'diện tích' }
const label = computed(() => FIELD_LABELS[props.field])
const inputLabel = computed(() => `${label.value.charAt(0).toUpperCase()}${label.value.slice(1)} phòng ${props.roomNumber}`)
const resetLabel = computed(() => `Khôi phục ${label.value} mặc định cho phòng ${props.roomNumber}`)

const numberMode = computed(() => ({ floor: 'integer', rent: 'currency', area: 'area' } as const)[props.field])

function onInput(raw: string) {
  if (props.field === 'floor') return emit('update', Math.min(100, Math.max(1, Math.trunc(Number(raw)) || 1)))
  if (props.field === 'rent') return emit('update', Number(raw) || 0)
  emit('update', raw === '' ? null : Number(raw))
}
</script>

<template>
  <div :class="clsx('rounded-md', overridden && !compact && 'bg-ui-accent/10')">
    <UiInput
      density="compact"
      type="number"
      :number-mode="numberMode"
      :min="field === 'floor' ? '1' : field === 'area' ? '0' : undefined"
      :max="field === 'floor' ? '100' : undefined"
      :placeholder="field === 'area' ? '—' : undefined"
      :disabled="disabled"
      :aria-label="inputLabel"
      :model-value="value !== null ? String(value) : ''"
      @update:model-value="onInput"
    />
    <div v-if="overridden" :class="clsx('flex items-center gap-1 whitespace-nowrap', compact ? 'justify-start' : 'justify-end')">
      <span v-if="!compact" class="text-xs text-ui-muted">Đã sửa</span>
      <UiButton
        variant="ghost"
        size="sm"
        :class="compact ? 'mt-0.5 h-7 w-full px-1 !text-ui-accent' : undefined"
        :disabled="disabled"
        :aria-label="resetLabel"
        @click="emit('reset')"
      >
        <IconRefresh v-if="compact" class="size-3.5" aria-hidden="true" />
        <span v-else>Mặc định</span>
      </UiButton>
    </div>
  </div>
</template>
