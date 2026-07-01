<script setup lang="ts">
import type { Component } from 'vue'
import clsx from 'clsx'
import type { AuditEntityType } from '~/utils/constants/audit'
import type { AuditEvent } from '~/types/audit'
import { formatRelativeTime } from '~/utils/format/relative-time'
import { formatDateTimeShort, formatTimeHHmm } from '~/utils/format/time'

definePageMeta({
  middleware: () => {
    const authStore = useAuthStore()
    if (!authStore.isAdmin) return navigateTo('/')
  },
})

const {
  buildingId,
  entityType,
  buildings,
  events,
  total,
  isLoading,
  refresh,
} = useAuditHistory()

const now = ref(new Date())
let nowInterval: ReturnType<typeof setInterval>
onMounted(() => { nowInterval = setInterval(() => { now.value = new Date() }, 30_000) })
onUnmounted(() => clearInterval(nowInterval))

const entityTypeOptions = [
  { value: '', label: 'Tất cả loại entity' },
  { value: 'building', label: 'Tòa nhà' },
  { value: 'room', label: 'Phòng' },
  { value: 'tenant', label: 'Khách thuê' },
  { value: 'contract', label: 'Hợp đồng' },
]

const buildingOptions = computed(() => [
  { value: '', label: 'Tất cả tòa nhà' },
  ...buildings.value.map(b => ({ value: b.id, label: b.name })),
])

const entityTypeLabels: Record<AuditEntityType | string, string> = {
  building: 'Tòa nhà',
  room: 'Phòng',
  tenant: 'Khách thuê',
  contract: 'Hợp đồng',
  contract_renewal: 'Gia hạn',
  meter_device: 'Đồng hồ',
  building_service: 'Dịch vụ tòa',
  contract_service: 'Dịch vụ hợp đồng',
}

interface EntityStyle {
  icon: Component | string
  ring: string
  bg: string
  fg: string
}

const entityStyles: Record<string, EntityStyle> = {
  building: { icon: 'IconBuilding', ring: 'ring-cyan/30', bg: 'bg-cyan/15', fg: 'text-cyan' },
  room: { icon: 'IconDoor', ring: 'ring-violet-500/30', bg: 'bg-violet-500/15', fg: 'text-violet-300' },
  tenant: { icon: 'IconUsers', ring: 'ring-blue-500/30', bg: 'bg-blue-500/15', fg: 'text-blue-300' },
  contract: { icon: 'IconDocumentText', ring: 'ring-amber-500/30', bg: 'bg-amber-500/15', fg: 'text-amber-300' },
  contract_renewal: { icon: 'IconRefresh', ring: 'ring-emerald-500/30', bg: 'bg-emerald-500/15', fg: 'text-emerald-300' },
  meter_device: { icon: 'IconCpu', ring: 'ring-fuchsia-500/30', bg: 'bg-fuchsia-500/15', fg: 'text-fuchsia-300' },
  building_service: { icon: 'IconLayers', ring: 'ring-teal-500/30', bg: 'bg-teal-500/15', fg: 'text-teal-300' },
  contract_service: { icon: 'IconLayers', ring: 'ring-teal-500/30', bg: 'bg-teal-500/15', fg: 'text-teal-300' },
}

const fallbackStyle: EntityStyle = {
  icon: 'IconInfoCircle',
  ring: 'ring-dark-border',
  bg: 'bg-dark-surface',
  fg: 'text-muted',
}

function styleFor(entityType: string): EntityStyle {
  return entityStyles[entityType] ?? fallbackStyle
}

function actionVariant(action: string): 'success' | 'accent' | 'danger' | 'warning' | 'neutral' {
  if (action.endsWith('.created') || action.endsWith('.activated')) return 'success'
  if (action.endsWith('.updated') || action.endsWith('.renewed')) return 'accent'
  if (action.endsWith('.removed') || action.endsWith('.terminated')) return 'danger'
  if (action.endsWith('.archived') || action.endsWith('.maintenance_set') || action.endsWith('.expired')) return 'warning'
  return 'neutral'
}

const actionSuffixLabel: Record<string, string> = {
  created: 'Tạo mới',
  updated: 'Cập nhật',
  removed: 'Xóa',
  archived: 'Lưu trữ',
  activated: 'Kích hoạt',
  terminated: 'Chấm dứt',
  expired: 'Hết hạn',
  renewed: 'Gia hạn',
  maintenance_set: 'Đặt bảo trì',
}

function actionSuffix(action: string): string {
  return action.split('.').pop() ?? action
}

function actionLabel(action: string): string {
  const suffix = actionSuffix(action)
  return actionSuffixLabel[suffix] ?? suffix
}

function entityDisplay(event: AuditEvent): string {
  if (event.entityLabel && event.entityLabel.trim()) return event.entityLabel
  if (event.entityId) return `#${event.entityId.slice(0, 8)}`
  return '—'
}

function actorDisplay(event: AuditEvent): { primary: string; secondary: string | null; isSystem: boolean } {
  if (!event.actorId) return { primary: 'Hệ thống', secondary: null, isSystem: true }
  if (event.actorName) {
    return { primary: event.actorName, secondary: event.actorEmail ?? null, isSystem: false }
  }
  if (event.actorEmail) {
    return { primary: event.actorEmail, secondary: null, isSystem: false }
  }
  return { primary: `#${event.actorId.slice(0, 8)}`, secondary: null, isSystem: false }
}

// Day grouping ---------------------------------------------------------
type DayBucket = 'today' | 'yesterday' | 'earlier'

const bucketLabels: Record<DayBucket, string> = {
  today: 'Hôm nay',
  yesterday: 'Hôm qua',
  earlier: 'Trước đó',
}

function startOfDay(date: Date): number {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function bucketFor(dateStr: string, reference: Date): DayBucket {
  const target = new Date(dateStr)
  const targetDay = startOfDay(target)
  const todayDay = startOfDay(reference)
  const diffDays = Math.round((todayDay - targetDay) / 86_400_000)
  if (diffDays <= 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  return 'earlier'
}

interface Group {
  key: DayBucket
  label: string
  events: AuditEvent[]
}

const groupedEvents = computed<Group[]>(() => {
  const reference = now.value
  const buckets: Record<DayBucket, AuditEvent[]> = { today: [], yesterday: [], earlier: [] }
  for (const evt of events.value) {
    buckets[bucketFor(evt.createdAt, reference)].push(evt)
  }
  return (['today', 'yesterday', 'earlier'] as DayBucket[])
    .filter(key => buckets[key].length > 0)
    .map(key => ({ key, label: bucketLabels[key], events: buckets[key] }))
})

// Diff detection -------------------------------------------------------
interface DiffRow {
  key: string
  before: unknown
  after: unknown
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function diffFields(before: unknown, after: unknown): DiffRow[] {
  if (!isPlainObject(before) && !isPlainObject(after)) return []
  const b = isPlainObject(before) ? before : {}
  const a = isPlainObject(after) ? after : {}
  const keys = new Set([...Object.keys(b), ...Object.keys(a)])
  const rows: DiffRow[] = []
  for (const key of keys) {
    if (JSON.stringify(b[key]) !== JSON.stringify(a[key])) {
      rows.push({ key, before: b[key], after: a[key] })
    }
  }
  return rows.sort((x, y) => x.key.localeCompare(y.key))
}

const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function formatDateOnly(input: string): string {
  const [y, m, d] = input.split('-')
  return `${d}/${m}/${y}`
}

function formatDateTime(input: string): string {
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return input
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${day}/${month}/${year} ${hour}:${minute}`
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') {
    if (value === '') return '—'
    if (ISO_DATETIME_RE.test(value)) return formatDateTime(value)
    if (ISO_DATE_RE.test(value)) return formatDateOnly(value)
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value, null, 2)
}

const expandedId = ref<string | null>(null)
function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}

const hasActiveFilters = computed(() => Boolean(buildingId.value || entityType.value))
function clearFilters() {
  buildingId.value = ''
  entityType.value = ''
}
</script>

<template>
  <div class="space-y-5">
    <UiPageHeader
      title="Audit Log"
      description="Lịch sử thay đổi dữ liệu master — ai đã làm gì với tòa nhà, phòng, khách thuê, hợp đồng."
    />

    <!-- Toolbar -->
    <UiToolbar>
      <UiSelect
        v-model="buildingId"
        :options="buildingOptions"
        class="min-w-48"
      />
      <UiSelect
        v-model="entityType"
        :options="entityTypeOptions"
        class="min-w-44"
      />
      <UiButton
        v-if="hasActiveFilters"
        unstyled
        class="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted transition-colors hover:bg-dark-hover hover:text-white"
        @click="clearFilters"
      >
        <IconX class="h-3.5 w-3.5" aria-hidden="true" />
        Xóa lọc
      </UiButton>
      <span v-if="!isLoading" class="text-xs text-muted">
        {{ events.length }} / {{ total }} sự kiện
      </span>

      <template #actions>
        <UiButton
          unstyled
          class="inline-flex items-center gap-1.5 rounded-md border border-dark-border px-3 py-2 text-sm text-muted transition-colors hover:bg-dark-hover hover:text-white"
          :class="{ 'opacity-50 pointer-events-none': isLoading }"
          @click="refresh()"
        >
          <IconRefresh class="h-4 w-4" :class="{ 'animate-spin': isLoading }" aria-hidden="true" />
          Làm mới
        </UiButton>
      </template>
    </UiToolbar>

    <!-- Loading skeleton -->
    <div v-if="isLoading" class="space-y-2">
      <UiSkeleton v-for="i in 8" :key="i" class="h-16 w-full" />
    </div>

    <!-- Empty state -->
    <UiEmptyState
      v-else-if="events.length === 0"
      title="Chưa có sự kiện nào"
      description="Thực hiện một thao tác (tạo, cập nhật, xóa) để xem log tại đây."
    />

    <!-- Grouped event list -->
    <div v-else class="space-y-6">
      <section
        v-for="group in groupedEvents"
        :key="group.key"
        class="space-y-2"
      >
        <!-- Day heading -->
        <div class="flex items-center gap-3">
          <h3 class="text-xs font-semibold uppercase tracking-wider text-muted">
            {{ group.label }}
          </h3>
          <span class="rounded-full bg-dark-surface px-2 py-0.5 text-[10px] font-medium text-muted">
            {{ group.events.length }}
          </span>
          <div class="h-px flex-1 bg-dark-border" />
        </div>

        <!-- Card -->
        <div class="overflow-hidden rounded-lg border border-dark-border bg-dark-surface/40">
          <div
            v-for="event in group.events"
            :key="event.id"
            class="border-b border-dark-border last:border-b-0"
          >
            <!-- Main row -->
            <UiButton
              unstyled
              class="group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-dark-hover"
              :class="{ 'bg-dark-hover': expandedId === event.id }"
              @click="toggleExpand(event.id)"
            >
              <!-- Entity icon avatar -->
              <span
                class="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1"
                :class="[styleFor(event.entityType).bg, styleFor(event.entityType).ring]"
                aria-hidden="true"
              >
                <component
                  :is="styleFor(event.entityType).icon"
                  class="h-4 w-4"
                  :class="styleFor(event.entityType).fg"
                />
              </span>

              <!-- Content -->
              <div class="min-w-0 flex-1 space-y-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-sm text-white">
                    <span class="text-muted">{{ actionLabel(event.action).toLowerCase() }} {{ (entityTypeLabels[event.entityType] ?? event.entityType).toLowerCase() }}</span>
                    <span class="ml-1 font-semibold text-white">{{ entityDisplay(event) }}</span>
                    <span v-if="event.entitySubLabel" class="ml-1 text-xs text-muted">· {{ event.entitySubLabel }}</span>
                  </span>
                  <UiBadge :variant="actionVariant(event.action)" size="sm">
                    {{ actionLabel(event.action) }}
                  </UiBadge>
                  <span v-if="event.correlationId" class="rounded-full bg-dark-surface px-1.5 py-0.5 text-[10px] font-medium text-muted">
                    bulk
                  </span>
                </div>
                <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  <span class="inline-flex items-center gap-1">
                    <IconUsers class="h-3 w-3" aria-hidden="true" />
                    <span :class="{ 'italic': actorDisplay(event).isSystem }">{{ actorDisplay(event).primary }}</span>
                    <span v-if="actorDisplay(event).secondary" class="text-white/40">· {{ actorDisplay(event).secondary }}</span>
                  </span>
                </div>
              </div>

              <!-- Timestamp + chevron -->
              <div class="flex shrink-0 items-start gap-2">
                <div class="text-right">
                  <p class="text-xs font-medium text-white/80" :title="formatDateTimeShort(event.createdAt)">
                    {{ formatTimeHHmm(event.createdAt) }}
                  </p>
                  <p class="text-[10px] text-muted">
                    {{ formatRelativeTime(event.createdAt, now) }}
                  </p>
                </div>
                <IconChevronDown
                  class="mt-1 h-4 w-4 text-muted transition-transform"
                  :class="{ 'rotate-180 text-white': expandedId === event.id }"
                  aria-hidden="true"
                />
              </div>
            </UiButton>

            <!-- Expanded: diff / raw -->
            <div v-if="expandedId === event.id" class="border-t border-dark-border bg-dark-deep px-4 py-4">
              <template v-if="diffFields(event.beforeData, event.afterData).length > 0">
                <p class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
                  Thay đổi ({{ diffFields(event.beforeData, event.afterData).length }} trường)
                </p>
                <div class="overflow-hidden rounded-md border border-dark-border">
                  <div
                    class="grid gap-2 bg-dark-surface/60 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted"
                    style="grid-template-columns: 10rem minmax(0, 1fr) minmax(0, 1fr);"
                  >
                    <span>Trường</span>
                    <span>Trước</span>
                    <span>Sau</span>
                  </div>
                  <div
                    v-for="row in diffFields(event.beforeData, event.afterData)"
                    :key="row.key"
                    class="grid items-start gap-2 border-t border-dark-border px-3 py-2 text-xs"
                    style="grid-template-columns: 10rem minmax(0, 1fr) minmax(0, 1fr);"
                  >
                    <span class="truncate font-mono text-white/70">{{ row.key }}</span>
                    <pre class="min-w-0 whitespace-pre-wrap break-words font-mono text-error-vivid/90">{{ formatValue(row.before) }}</pre>
                    <pre class="min-w-0 whitespace-pre-wrap break-words font-mono text-success-neon">{{ formatValue(row.after) }}</pre>
                  </div>
                </div>
              </template>

              <!-- Fallback: raw snapshots (create/delete) -->
              <div
                v-else
                :class="clsx('grid gap-4', event.beforeData && event.afterData ? 'sm:grid-cols-2' : 'sm:grid-cols-1')"
              >
                <div v-if="event.beforeData">
                  <p class="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Trước</p>
                  <pre class="max-h-64 overflow-auto rounded-md border border-dark-border bg-dark-surface p-3 text-xs text-white/80">{{ JSON.stringify(event.beforeData, null, 2) }}</pre>
                </div>
                <div v-if="event.afterData">
                  <p class="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Sau</p>
                  <pre class="max-h-64 overflow-auto rounded-md border border-dark-border bg-dark-surface p-3 text-xs text-white/80">{{ JSON.stringify(event.afterData, null, 2) }}</pre>
                </div>
                <p v-if="!event.beforeData && !event.afterData" class="text-xs italic text-muted">
                  Không có snapshot dữ liệu.
                </p>
              </div>

              <!-- Metadata -->
              <div v-if="event.metadata && Object.keys(event.metadata).length" class="mt-4">
                <p class="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Metadata</p>
                <pre class="max-h-32 overflow-auto rounded-md border border-dark-border bg-dark-surface p-3 text-xs text-white/60">{{ JSON.stringify(event.metadata, null, 2) }}</pre>
              </div>

              <!-- Footer meta -->
              <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
                <span class="inline-flex items-center gap-1">
                  <IconClock class="h-3 w-3" aria-hidden="true" />
                  {{ formatDateTimeShort(event.createdAt) }}
                </span>
                <span class="inline-flex items-center gap-1 font-mono">
                  <IconCode class="h-3 w-3" aria-hidden="true" />
                  {{ event.action }}
                </span>
                <span v-if="event.correlationId" class="inline-flex items-center gap-1 font-mono">
                  <IconLink class="h-3 w-3" aria-hidden="true" />
                  {{ event.correlationId.slice(0, 8) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
