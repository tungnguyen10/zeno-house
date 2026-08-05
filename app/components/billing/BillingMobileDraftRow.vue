<script setup lang="ts">
import clsx from 'clsx'
import type { BillingDraftGridRow, BillingDraftGridUtilityCell } from '~/types/billing'
import { formatCurrency as formatCurrencyValue } from '~/utils/format/currency'
import { meterUnit, meterLabel } from '~/utils/billing/meter-display'

type MeterType = 'electricity' | 'water'

withDefaults(defineProps<{
  row: BillingDraftGridRow
  selectable: boolean
  selected: boolean
  readingValueOf: (row: BillingDraftGridRow, type: MeterType) => string
  isCellDirty: (row: BillingDraftGridRow, type: MeterType) => boolean
  isPasteHighlighted: (row: BillingDraftGridRow, type: MeterType) => boolean
  saveStateOf: (row: BillingDraftGridRow) => 'idle' | 'saving' | 'saved' | 'error'
  canManageIncidental?: boolean
}>(), {
  canManageIncidental: true,
})

const emit = defineEmits<{
  (e: 'update', payload: { row: BillingDraftGridRow; type: MeterType; value: string }): void
  (e: 'paste', payload: { event: ClipboardEvent; row: BillingDraftGridRow; type: MeterType }): void
  (e: 'keydown', payload: { event: KeyboardEvent; row: BillingDraftGridRow; type: MeterType }): void
  (e: 'blur', payload: { row: BillingDraftGridRow; type: MeterType }): void
  (e: 'override' | 'select' | 'detail' | 'add-incidental', row: BillingDraftGridRow): void
}>()

function meterCell(row: BillingDraftGridRow, type: MeterType): BillingDraftGridUtilityCell | null {
  return type === 'electricity' ? row.electricity : row.water
}

function formatCurrency(amount: number | null): string {
  return amount === null ? '—' : formatCurrencyValue(amount)
}

function formatRate(cell: BillingDraftGridUtilityCell | null): string {
  if (!cell || cell.rate === null) return '—'
  return `${formatCurrencyValue(cell.rate)}/${meterUnit(cell.meterType)}`
}
</script>

<template>
  <article
    :class="clsx(
      'space-y-3 rounded-lg border p-3',
      selected ? 'border-cyan/50 bg-cyan/5' : 'border-dark-border bg-dark-surface',
    )"
    :data-row="row.key"
    :data-selected="selected || undefined"
  >
    <header class="flex items-start justify-between gap-3">
      <div
        data-test="mobile-draft-select-cluster"
        class="flex min-w-0 flex-1 items-start gap-2"
      >
        <UiCheckbox
          v-if="selectable"
          data-test="mobile-draft-select"
          class="shrink-0 [&>label]:size-11 [&>label]:items-center [&>label]:justify-center"
          :model-value="selected"
          :aria-label="`Chọn phòng ${row.roomNumber ?? ''} để phát hành`"
          @update:model-value="emit('select', row)"
        />
        <div class="min-w-0 pt-0.5">
          <p class="text-sm font-semibold text-white">
            {{ row.roomNumber ?? '—' }}
            <template v-if="row.tenantName">
              <span class="text-muted">{{ '· ' }}</span>
              <span class="text-white">{{ row.tenantName }}</span>
            </template>
          </p>
          <p v-if="row.draftTotal !== null" class="text-xs text-muted">
            Tổng nháp: <span class="text-white tabular-nums">{{ formatCurrency(row.draftTotal) }}</span>
          </p>
        </div>
      </div>
      <div class="shrink-0 pt-0.5 text-[11px]">
        <span v-if="saveStateOf(row) === 'saving'" class="text-muted">Đang lưu...</span>
        <span v-else-if="saveStateOf(row) === 'saved'" class="text-emerald-400">Đã lưu ✓</span>
        <span v-else-if="saveStateOf(row) === 'error'" class="text-rose-400">Lỗi</span>
      </div>
    </header>

    <div
      v-for="type in (['electricity', 'water'] as MeterType[])"
      :key="type"
      class="space-y-1"
    >
      <template v-if="meterCell(row, type)">
        <div class="flex items-center gap-2">
          <span class="text-xs text-muted w-10 shrink-0">{{ meterLabel(type) }}</span>
          <UiInput
            v-if="meterCell(row, type)!.editable"
            type="number"
            number-mode="meter"
            :placeholder="meterUnit(type)"
            :model-value="readingValueOf(row, type)"
            density="compact"
            class="flex-1"
            :class="clsx(
              isPasteHighlighted(row, type) && 'bg-amber-100/40',
            )"
            @update:model-value="emit('update', { row, type, value: String($event ?? '') })"
            @keydown="emit('keydown', { event: $event, row, type })"
            @paste="emit('paste', { event: $event, row, type })"
            @blur="emit('blur', { row, type })"
          />
          <span v-else class="flex-1 text-sm text-white tabular-nums">
            {{ meterCell(row, type)!.currentValue ?? '—' }}
          </span>
          <span class="text-xs text-muted tabular-nums w-20 text-right">
            {{ formatCurrency(meterCell(row, type)!.amount) }}
          </span>
        </div>
        <p class="flex items-center gap-1.5 text-[11px] text-muted pl-12">
          <span
            aria-hidden="true"
            :class="clsx(
              'inline-block h-1.5 w-1.5 shrink-0 rounded-full transition-all',
              saveStateOf(row) === 'saving' ? 'bg-cyan/70 animate-pulse' :
              saveStateOf(row) === 'saved' ? 'bg-emerald-400' :
              saveStateOf(row) === 'error' ? 'bg-rose-400' :
              isCellDirty(row, type) ? 'bg-amber-400/60' :
              'opacity-0',
            )"
          />
          Cũ
          <span class="text-white tabular-nums">
            {{ meterCell(row, type)!.previousValue ?? '—' }}
          </span>
          →
          Mới
          <span class="text-white tabular-nums">
            {{ readingValueOf(row, type) || meterCell(row, type)!.currentValue || '—' }}
          </span>
          · {{ meterLabel(type) }} {{ formatRate(meterCell(row, type)) }}
        </p>
      </template>
    </div>

    <footer class="flex flex-wrap items-center gap-1 border-t border-dark-border pt-2">
      <UiButton variant="ghost" size="sm" class="min-h-11 whitespace-nowrap" @click="emit('detail', row)">Chi tiết</UiButton>
      <UiButton
        v-if="canManageIncidental && row.contractId && row.editable"
        variant="ghost"
        size="sm"
        class="min-h-11 whitespace-nowrap"
        @click="emit('add-incidental', row)"
      >
        <IconPlus class="h-4 w-4" aria-hidden="true" />
        Thêm phát sinh
      </UiButton>
      <UiButton
        v-if="(row.electricity?.required || row.water?.required) && row.editable"
        variant="ghost"
        size="sm"
        class="min-h-11 whitespace-nowrap"
        @click="emit('override', row)"
      >
        Điều chỉnh chỉ số
      </UiButton>
    </footer>
  </article>
</template>
