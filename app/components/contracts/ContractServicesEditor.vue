<script setup lang="ts">
export interface ContractServiceRow {
  catalog_id: string
  name: string
  amount: number
  quantity: number
  is_enabled: boolean
  notes: string | null
}

const props = withDefaults(defineProps<{
  modelValue: ContractServiceRow[]
  disabled?: boolean
}>(), { disabled: false })

const emit = defineEmits<{ 'update:modelValue': [rows: ContractServiceRow[]] }>()

function update(index: number, patch: Partial<ContractServiceRow>) {
  emit('update:modelValue', props.modelValue.map((row, i) => (i === index ? { ...row, ...patch } : row)))
}
</script>

<template>
  <div class="space-y-3">
    <p v-if="modelValue.length === 0" class="text-sm text-ui-muted">
      Tòa nhà chưa bật dịch vụ nào.
    </p>

    <div
      v-for="(row, index) in modelValue"
      :key="row.catalog_id"
      class="rounded-lg border border-ui-border bg-ui-surface p-3"
    >
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-12">
        <div class="flex items-center gap-2 sm:col-span-4">
          <UiToggle
            :model-value="row.is_enabled"
            :disabled="disabled"
            :aria-label="`Bật dịch vụ ${row.name}`"
            @update:model-value="(v: boolean) => update(index, { is_enabled: v })"
          />
          <span class="text-sm font-medium text-ui-primary">{{ row.name }}</span>
        </div>
        <div class="sm:col-span-3">
          <UiInput
            :model-value="String(row.amount)"
            label="Đơn giá (đ)"
            type="number"
            number-mode="currency"
            density="compact"
            :disabled="disabled || !row.is_enabled"
            :aria-label="`Đơn giá ${row.name}`"
            @update:model-value="(v: string) => update(index, { amount: Number(v) || 0 })"
          />
        </div>
        <div class="sm:col-span-2">
          <UiInput
            :model-value="String(row.quantity)"
            label="Số lượng"
            type="number"
            number-mode="integer"
            density="compact"
            :disabled="disabled || !row.is_enabled"
            :aria-label="`Số lượng ${row.name}`"
            @update:model-value="(v: string) => update(index, { quantity: Math.max(0, Number(v) || 0) })"
          />
        </div>
        <div class="sm:col-span-3">
          <UiInput
            :model-value="row.notes ?? ''"
            label="Ghi chú"
            density="compact"
            :disabled="disabled || !row.is_enabled"
            :aria-label="`Ghi chú ${row.name}`"
            @update:model-value="(v: string) => update(index, { notes: v.trim() === '' ? null : v })"
          />
        </div>
      </div>
    </div>
  </div>
</template>
