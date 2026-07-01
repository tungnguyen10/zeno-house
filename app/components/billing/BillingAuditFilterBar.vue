<script setup lang="ts">
import type { BillingAuditEvent } from '~/types/billing'
import type { BillingAuditFilters } from '~/composables/billing/useBillingAuditList'
import type { BillingAuditCategory } from '~/utils/constants/billing'
import { AUDIT_CATEGORY_VISUALS } from '~/utils/billing/audit-category'

const props = defineProps<{
  filters: BillingAuditFilters
  total: number
  loading: boolean
  /** Period contributors (actor filter). */
  contributors?: { id: string; name: string | null; email: string | null }[]
  /** Period slug or display label used for CSV filename. */
  periodLabel?: string
  /** All events fetched so far (used for CSV export). */
  events: BillingAuditEvent[]
}>()

const emit = defineEmits<{
  (e: 'update:filters', filters: BillingAuditFilters): void
  (e: 'reset' | 'refresh'): void
}>()

// ── Category chips ─────────────────────────────────────────────────────────
const categoryOptions = AUDIT_CATEGORY_VISUALS.map(v => ({ value: v.category, label: v.label }))

const selectedCategories = computed({
  get: () => props.filters.categories,
  set: (v: BillingAuditCategory[]) => emit('update:filters', { ...props.filters, categories: v }),
})

// ── Critical toggle (D4): destructive + status.reopened + period.unissued ──
const criticalActions = new Set(['invoice.voided', 'payment.undone', 'period.unissued', 'period.reopened'])
const criticalOnly = computed({
  get: () =>
    props.filters.categories.includes('destructive')
    && !props.filters.categories.includes('create')
    && !props.filters.categories.includes('edit')
    && !props.filters.categories.includes('status')
    && !props.filters.categories.includes('other'),
  set: (v: boolean) => {
    emit('update:filters', {
      ...props.filters,
      categories: v ? (['destructive'] as BillingAuditCategory[]) : [],
    })
  },
})

// ── Date range ─────────────────────────────────────────────────────────────
const fromDate = computed({
  get: () => props.filters.from ? props.filters.from.slice(0, 10) : '',
  set: (v: string) => emit('update:filters', {
    ...props.filters,
    from: v ? `${v}T00:00:00+07:00` : '',
  }),
})

const toDate = computed({
  get: () => props.filters.to ? props.filters.to.slice(0, 10) : '',
  set: (v: string) => emit('update:filters', {
    ...props.filters,
    to: v ? `${v}T23:59:59+07:00` : '',
  }),
})

// ── Search ─────────────────────────────────────────────────────────────────
const searchQ = computed({
  get: () => props.filters.q,
  set: (v: string) => emit('update:filters', { ...props.filters, q: v }),
})

// ── Actor filter ───────────────────────────────────────────────────────────
function actorLabel(c: { id: string; name: string | null; email: string | null }): string {
  return c.name ?? c.email ?? c.id.slice(0, 8)
}

const actorMenu = ref(false)
const actorAnchor = ref<HTMLElement | null>(null)

function toggleActor(id: string) {
  const current = props.filters.actorIds
  const next = current.includes(id) ? current.filter(a => a !== id) : [...current, id]
  emit('update:filters', { ...props.filters, actorIds: next })
}

// ── CSV Export (D10) ───────────────────────────────────────────────────────
const criticalActionsSet = criticalActions

function compactJson(v: unknown): string {
  return JSON.stringify(v)
}

function escCsv(v: unknown): string {
  const s = v == null ? '' : String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function exportCsv() {
  const BOM = '\uFEFF'
  const header = ['Thời điểm', 'Email', 'Hành động', 'Đối tượng', 'Nhãn đối tượng', 'Tóm tắt', 'Correlation ID', 'Metadata']
  const rows = props.events.map(ev => [
    ev.createdAt,
    ev.actorEmail ?? ev.actorName ?? ev.actorId ?? '',
    ev.action,
    ev.entityType,
    ev.entityLabel ?? '',
    ev.summary ?? '',
    ev.correlationId ?? '',
    compactJson(ev.metadata),
  ])
  const csv = [header, ...rows].map(row => row.map(escCsv).join(',')).join('\r\n')
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const date = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `audit-${props.periodLabel ?? 'period'}-${date}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const hasActiveFilters = computed(() =>
  props.filters.actorIds.length > 0
  || props.filters.categories.length > 0
  || !!props.filters.from
  || !!props.filters.to
  || !!props.filters.q.trim()
  || !!props.filters.correlationId.trim(),
)
</script>

<template>
  <div class="space-y-3">
    <!-- Header row: title + event count + actions -->
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-white">Nhật ký kỳ vận hành</span>
        <span v-if="total > 0" class="text-xs text-muted tabular-nums">({{ total }})</span>
      </div>
      <div class="flex items-center gap-2">
        <UiButton
          v-if="hasActiveFilters"
          variant="ghost"
          size="sm"
          @click="$emit('reset')"
        >
          Xoá bộ lọc
        </UiButton>
        <UiButton
          variant="ghost"
          size="sm"
          :disabled="events.length === 0"
          title="Xuất CSV"
          @click="exportCsv"
        >
          <IconDownload class="h-4 w-4" aria-hidden="true" />
          <span class="hidden sm:inline">Xuất CSV</span>
        </UiButton>
        <UiButton
          variant="secondary"
          size="sm"
          :disabled="loading"
          @click="$emit('refresh')"
        >
          <IconRefresh :class="['h-4 w-4', loading && 'animate-spin']" aria-hidden="true" />
          <span class="sr-only">Làm mới</span>
        </UiButton>
      </div>
    </div>

    <!-- Search (D5) -->
    <UiSearchInput
      :model-value="searchQ"
      placeholder="Tìm trong nhật ký…"
      :debounce="300"
      density="compact"
      aria-label="Tìm kiếm sự kiện"
      @update:model-value="searchQ = $event"
    />

    <!-- Category chips (D4) -->
    <UiFilterChips
      v-model="selectedCategories"
      :options="categoryOptions"
      aria-label="Lọc theo loại"
    />

    <!-- Correlation filter active indicator -->
    <div
      v-if="filters.correlationId"
      class="flex items-center gap-2 text-xs rounded bg-amber-500/10 border border-amber-500/30 px-2 py-1.5"
    >
      <span class="text-amber-300 flex-1 truncate font-mono">
        correlation: {{ filters.correlationId }}
      </span>
      <button
        type="button"
        class="text-muted hover:text-white transition-colors"
        @click="$emit('update:filters', { ...filters, correlationId: '' })"
      >
        ✕
      </button>
    </div>

    <!-- Row: actor + date range + critical toggle -->
    <div class="flex flex-wrap gap-2 items-center">
      <!-- Actor multi-select (D4) -->
      <div v-if="contributors && contributors.length > 0" class="relative">
        <UiButton
          ref="actorAnchor"
          variant="secondary"
          size="sm"
          @click="actorMenu = !actorMenu"
        >
          Người thực hiện{{ filters.actorIds.length ? ` (${filters.actorIds.length})` : '' }}
          <IconChevronDown class="h-3 w-3 ml-1 -mr-1" aria-hidden="true" />
        </UiButton>
        <template v-if="actorMenu">
          <div class="fixed inset-0 z-30" aria-hidden="true" @click="actorMenu = false" />
          <div class="absolute left-0 z-40 mt-1 w-56 rounded-lg border border-dark-border bg-dark-card py-1 shadow-lg shadow-black/40">
            <button
              v-for="c in contributors"
              :key="c.id"
              type="button"
              class="flex w-full items-center gap-2 px-3 py-2 text-sm text-white hover:bg-dark-surface transition-colors"
              @click="toggleActor(c.id)"
            >
              <span
                :class="[
                  'h-3.5 w-3.5 rounded border border-dark-border flex-none transition-colors',
                  filters.actorIds.includes(c.id) ? 'bg-cyan border-cyan' : '',
                ]"
                aria-hidden="true"
              />
              <span class="truncate">{{ actorLabel(c) }}</span>
            </button>
          </div>
        </template>
      </div>

      <!-- Date from/to (D4) -->
      <UiInput
        :model-value="fromDate"
        type="date"
        placeholder="Từ ngày"
        density="compact"
        aria-label="Từ ngày"
        @update:model-value="fromDate = $event"
      />
      <UiInput
        :model-value="toDate"
        type="date"
        placeholder="Đến ngày"
        density="compact"
        aria-label="Đến ngày"
        @update:model-value="toDate = $event"
      />

      <!-- Critical-only toggle (D4) -->
      <UiToggle
        v-model="criticalOnly"
        label="Chỉ critical"
        size="sm"
        :title="`Chỉ hiện các thao tác phá huỷ: ${[...criticalActionsSet].join(', ')}`"
      />
    </div>
  </div>
</template>
