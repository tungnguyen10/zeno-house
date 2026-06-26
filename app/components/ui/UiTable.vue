<script setup lang="ts" generic="TRow extends object">
import { computed } from 'vue'
import clsx from 'clsx'

export interface UiTableColumn<TRow> {
  /** Stable key. Used for `th`/`td` keys. */
  key: string
  /** Header label. Optional for action columns. */
  label?: string
  /** Right-align numeric columns (currency, totals, readings, counts). */
  numeric?: boolean
  /** Hide column at < md breakpoint. */
  hideOnMobile?: boolean
  /** Fixed width via Tailwind class, e.g. `w-32`, `w-1/3`. */
  width?: string
  /** Mark this column as the action column (no padding tweaks, last). */
  action?: boolean
  /** Optional accessor for non-slot rendering of plain text columns. */
  accessor?: (row: TRow) => string | number | null | undefined
}

const props = withDefaults(defineProps<{
  rows: TRow[]
  columns: UiTableColumn<TRow>[]
  /** Property name used to derive a stable row key. Defaults to `'id'`. */
  rowKey?: string
  loading?: boolean
  /** When `loading` is true, renders this many skeleton rows. */
  loadingRows?: number
  /** Empty state title rendered when `rows.length === 0` and not loading. */
  emptyTitle?: string
  emptyDescription?: string
  /** Compact dense rows (default) vs comfortable. */
  density?: 'dense' | 'comfortable'
  /** Sticky header for tall tables. */
  stickyHeader?: boolean
  /** Optional click handler; when set, rows render with hover affordance. */
  rowClickable?: boolean
  /** Optional caption for screen readers. */
  caption?: string
}>(), {
  rowKey: 'id',
  loading: false,
  loadingRows: 5,
  density: 'dense',
  stickyHeader: false,
  rowClickable: false,
})

const emit = defineEmits<{
  (e: 'rowClick', row: TRow): void
}>()

const cellPadding = computed(() => (props.density === 'dense' ? 'px-3 py-2' : 'px-4 py-3'))

function cellAlign(col: UiTableColumn<TRow>) {
  return col.numeric ? 'text-right tabular-nums' : 'text-left'
}

function getRowKey(row: TRow): string | number {
  const value = (row as Record<string, unknown>)[props.rowKey]
  if (typeof value === 'string' || typeof value === 'number') return value
  return JSON.stringify(row)
}

function getCellValue(row: TRow, col: UiTableColumn<TRow>): unknown {
  if (col.accessor) return col.accessor(row)
  return (row as Record<string, unknown>)[col.key]
}
</script>

<template>
  <div class="relative overflow-x-auto rounded-xl border border-dark-border bg-dark-surface">
    <table class="min-w-full text-sm">
      <caption v-if="caption" class="sr-only">{{ caption }}</caption>
      <thead
        :class="clsx(
          'bg-dark-card text-xs uppercase tracking-wide text-muted',
          stickyHeader && 'sticky top-0 z-10',
        )"
      >
        <tr>
          <th
            v-for="col in columns"
            :key="col.key"
            scope="col"
            :class="clsx(
              cellPadding,
              cellAlign(col),
              col.hideOnMobile && 'hidden md:table-cell',
              col.width,
              'font-medium',
            )"
          >
            <slot :name="`header-${col.key}`" :column="col">
              <span :class="col.action ? 'sr-only' : ''">{{ col.label ?? '' }}</span>
            </slot>
          </th>
        </tr>
      </thead>

      <tbody class="divide-y divide-dark-border">
        <!-- Loading -->
        <template v-if="loading">
          <tr v-for="n in loadingRows" :key="`loading-${n}`">
            <td
              v-for="col in columns"
              :key="col.key"
              :class="clsx(cellPadding, col.hideOnMobile && 'hidden md:table-cell')"
            >
              <UiSkeleton class="h-4 w-3/4" />
            </td>
          </tr>
        </template>

        <!-- Empty -->
        <tr v-else-if="rows.length === 0">
          <td :colspan="columns.length" class="px-3 py-10">
            <slot name="empty">
              <UiEmptyState
                :title="emptyTitle ?? 'Chưa có dữ liệu'"
                :description="emptyDescription"
              >
                <template v-if="$slots.emptyAction" #action>
                  <slot name="emptyAction" />
                </template>
              </UiEmptyState>
            </slot>
          </td>
        </tr>

        <!-- Rows -->
        <tr
          v-for="row in rows"
          v-else
          :key="getRowKey(row)"
          :class="clsx(
            'transition-colors',
            rowClickable && 'cursor-pointer hover:bg-dark-hover',
          )"
          @click="rowClickable ? emit('rowClick', row) : undefined"
        >
          <td
            v-for="col in columns"
            :key="col.key"
            :class="clsx(
              cellPadding,
              cellAlign(col),
              col.hideOnMobile && 'hidden md:table-cell',
              'text-white align-middle',
            )"
          >
            <slot
              :name="`cell-${col.key}`"
              :row="row"
              :value="getCellValue(row, col)"
            >
              {{ getCellValue(row, col) }}
            </slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
