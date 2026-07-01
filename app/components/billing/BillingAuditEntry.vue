<script setup lang="ts">
import type { BillingAuditEvent } from '~/types/billing'
import { auditCategoryForAction, auditCategoryVisual } from '~/utils/billing/audit-category'
import { auditEntityLink } from '~/utils/billing/audit-entity-link'

const props = defineProps<{
  event: BillingAuditEvent
}>()

defineEmits<{
  (e: 'filterCorrelation', id: string): void
}>()

const category = computed(() => auditCategoryForAction(props.event.action))
const visual = computed(() => auditCategoryVisual(category.value))
const entityLink = computed(() => auditEntityLink(props.event))

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('vi-VN', { hour12: false })
  }
  catch {
    return iso
  }
}

function actorLabel(ev: BillingAuditEvent): string {
  return ev.actorName ?? ev.actorEmail ?? (ev.actorId ? 'Người dùng' : 'Hệ thống')
}

/** Category icon glyph (Heroicons outline 20px, inline SVG paths). */
const iconPath = computed(() => {
  switch (category.value) {
    case 'create':
      return 'M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v2.5h-2.5a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z'
    case 'edit':
      return 'M2.695 14.762l-1.262 3.155a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.502a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.342z'
    case 'destructive':
      return 'M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z'
    case 'status':
      return 'M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z'
    default:
      return 'M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z'
  }
})

/**
 * Diff view (D6): detect diff-able actions and render a before → after line.
 */
interface DiffView {
  label: string
  before: string | number | null
  after: string | number | null
  delta?: string | number | null
}

function formatDiffVal(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'number') return v.toLocaleString('vi-VN')
  return String(v)
}

const diff = computed((): DiffView | null => {
  const { action, metadata, beforeData, afterData } = props.event
  const before = beforeData as Record<string, unknown> | null
  const after = afterData as Record<string, unknown> | null
  const meta = metadata as Record<string, unknown>

  if (action === 'reading.saved') {
    const prev = meta?.previous_value ?? before?.value_kwh ?? null
    const next = meta?.new_value ?? after?.value_kwh ?? null
    const delta = (typeof next === 'number' && typeof prev === 'number')
      ? next - prev
      : null
    return { label: 'Chỉ số', before: prev as number | null, after: next as number | null, delta }
  }

  if (action === 'payment.undone') {
    const amount = meta?.amount ?? (before as Record<string, unknown> | null)?.amount ?? null
    return { label: 'Thanh toán', before: amount as number | null, after: 0 }
  }

  if (action === 'utility_override.saved') {
    const prev = before?.total_amount ?? null
    const next = after?.total_amount ?? null
    return { label: 'Chi phí dịch vụ', before: prev as number | null, after: next as number | null }
  }

  return null
})

const expanded = ref(false)

function hasTechnicalDetail(ev: BillingAuditEvent): boolean {
  return !!(ev.beforeData || ev.afterData || Object.keys(ev.metadata ?? {}).length > 0)
}

function technicalJson(ev: BillingAuditEvent): string {
  const detail: Record<string, unknown> = {}
  if (ev.beforeData !== null && ev.beforeData !== undefined) detail.before = ev.beforeData
  if (ev.afterData !== null && ev.afterData !== undefined) detail.after = ev.afterData
  if (Object.keys(ev.metadata ?? {}).length > 0) detail.metadata = ev.metadata
  return JSON.stringify(detail, null, 2)
}
</script>

<template>
  <div class="flex gap-3 py-3 px-1 group">
    <!-- Leading icon bubble (D3) -->
    <div
      :class="['flex-none flex h-7 w-7 items-center justify-center rounded-full mt-0.5', visual.bubbleClass]"
      :title="visual.label"
    >
      <svg viewBox="0 0 20 20" fill="currentColor" :class="['h-4 w-4', visual.iconClass]" aria-hidden="true">
        <path :d="iconPath" />
      </svg>
    </div>

    <!-- Content -->
    <div class="min-w-0 flex-1 space-y-0.5">
      <!-- Summary line -->
      <div class="flex items-start justify-between gap-2">
        <p class="text-sm text-white leading-snug">
          {{ event.summary ?? event.action }}
        </p>
        <time class="flex-none text-xs text-muted tabular-nums whitespace-nowrap mt-0.5">
          {{ formatTime(event.createdAt) }}
        </time>
      </div>

      <!-- Actor + entity -->
      <div class="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
        <span :title="event.actorEmail ?? undefined">{{ actorLabel(event) }}</span>
        <NuxtLink
          v-if="entityLink"
          :to="entityLink"
          class="text-cyan-400 hover:underline underline-offset-2"
        >
          {{ event.entityLabel ?? event.entityType }}
          <span v-if="event.entitySubLabel" class="text-muted ml-1">{{ event.entitySubLabel }}</span>
        </NuxtLink>
        <span v-else-if="event.entityLabel">
          {{ event.entityLabel }}
          <span v-if="event.entitySubLabel" class="text-muted ml-1">{{ event.entitySubLabel }}</span>
        </span>
      </div>

      <!-- Diff view (D6) -->
      <div v-if="diff" class="mt-1 flex items-center gap-2 text-xs rounded bg-dark-surface px-2 py-1 font-mono w-fit max-w-full">
        <span class="text-muted">{{ diff.label }}:</span>
        <span class="text-rose-300 line-through">{{ formatDiffVal(diff.before) }}</span>
        <span class="text-muted">→</span>
        <span class="text-emerald-300">{{ formatDiffVal(diff.after) }}</span>
        <span v-if="diff.delta != null" class="text-muted">({{ typeof diff.delta === 'number' && diff.delta > 0 ? '+' : '' }}{{ formatDiffVal(diff.delta) }})</span>
      </div>

      <!-- Action row: category chip + correlation + entity link + expand -->
      <div class="flex flex-wrap items-center gap-2 pt-1">
        <span
          :class="['inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', visual.badgeClass]"
        >
          {{ visual.label }}
        </span>

        <!-- Correlation (D7) -->
        <button
          v-if="event.correlationId"
          type="button"
          class="text-xs text-muted hover:text-white underline underline-offset-2 transition-colors"
          :title="`Xem cùng correlation: ${event.correlationId}`"
          @click="$emit('filterCorrelation', event.correlationId)"
        >
          Xem cùng nhóm
        </button>

        <!-- Entity quick-open (D8) -->
        <NuxtLink
          v-if="entityLink"
          :to="entityLink"
          class="text-xs text-muted hover:text-white transition-colors"
        >
          → Mở
        </NuxtLink>

        <!-- Technical details expand -->
        <button
          v-if="hasTechnicalDetail(event)"
          type="button"
          class="text-xs text-muted hover:text-white transition-colors ml-auto"
          @click="expanded = !expanded"
        >
          {{ expanded ? 'Ẩn' : 'Chi tiết kỹ thuật' }}
        </button>
      </div>

      <!-- Technical JSON (collapsible) -->
      <pre
        v-if="expanded"
        class="mt-2 rounded bg-dark-surface text-xs text-muted p-2 overflow-x-auto whitespace-pre-wrap break-all"
      >{{ technicalJson(event) }}</pre>
    </div>
  </div>
</template>
