<script setup lang="ts">

import clsx from 'clsx'
import type { AuditEvent } from '~/types/audit'
import {
  AUDIT_ENTITY_FILTER_OPTIONS,
  auditActionLabel,
  auditActionVariant,
  auditDiffRows,
  auditEntityDisplay,
  auditEntityLabel,
  auditEntityStyle,
} from '~/utils/audit/display'
import { formatRelativeTime } from '~/utils/format/relative-time'
import { formatDateTimeShort, formatTimeHHmm } from '~/utils/format/time'

definePageMeta({
  middleware: () => {
    const authStore = useAuthStore()
    if (!authStore.isAdmin) return navigateTo('/dashboard')
  },
})

const {
  buildingId,
  entityType,
  buildings,
  events,
  total,
  isLoading,
  isLoadingMore,
  hasMore,
  loadMore,
  error,
  refresh,
} = useAuditHistory()

const now = ref(new Date())
let nowInterval: ReturnType<typeof setInterval>
onMounted(() => { nowInterval = setInterval(() => { now.value = new Date() }, 30_000) })
onUnmounted(() => clearInterval(nowInterval))

const entityTypeOptions = AUDIT_ENTITY_FILTER_OPTIONS

const buildingOptions = computed(() => [
  { value: '', label: 'Tất cả tòa nhà' },
  ...buildings.value.map(b => ({ value: b.id, label: b.name })),
])

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
      title="Nhật ký hoạt động"
      description="Theo dõi thay đổi master data, phân quyền, hợp đồng, vận hành và tenant portal."
    />

    <!-- Toolbar -->
    <UiToolbar>
      <UiSelect
        v-model="buildingId"
        :options="buildingOptions"
        aria-label="Lọc lịch sử theo tòa nhà"
        class="min-w-48"
      />
      <UiSelect
        v-model="entityType"
        :options="entityTypeOptions"
        aria-label="Lọc lịch sử theo loại dữ liệu"
        class="min-w-44"
      />
      <UiFilterResetButton v-if="hasActiveFilters" label="Xóa lọc" @click="clearFilters" />
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

    <div v-else-if="error" class="rounded-lg border border-error-vivid/30 bg-error-vivid/5 px-4 py-5 text-sm">
      <p class="font-medium text-error-vivid">Không thể tải nhật ký hoạt động</p>
      <p class="mt-1 text-muted">Vui lòng thử lại. Bộ lọc hiện tại vẫn được giữ nguyên.</p>
      <UiButton variant="secondary" size="sm" class="mt-3" @click="refresh()">
        Thử lại
      </UiButton>
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
                :class="[auditEntityStyle(event.entityType).bg, auditEntityStyle(event.entityType).ring]"
                aria-hidden="true"
              >
                <component
                  :is="auditEntityStyle(event.entityType).icon"
                  class="h-4 w-4"
                  :class="auditEntityStyle(event.entityType).fg"
                />
              </span>

              <!-- Content -->
              <div class="min-w-0 flex-1 space-y-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-sm text-white">
                    <span class="text-muted">{{ auditActionLabel(event.action).toLowerCase() }} {{ auditEntityLabel(event.entityType).toLowerCase() }}</span>
                    <span class="ml-1 font-semibold text-white">{{ auditEntityDisplay(event) }}</span>
                    <span v-if="event.entitySubLabel" class="ml-1 text-xs text-muted">· {{ event.entitySubLabel }}</span>
                  </span>
                  <UiBadge :variant="auditActionVariant(event.action)" size="sm">
                    {{ auditActionLabel(event.action) }}
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
              <template v-if="auditDiffRows(event.beforeData, event.afterData, event.entityType).length > 0">
                <p class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
                  Thay đổi ({{ auditDiffRows(event.beforeData, event.afterData, event.entityType).length }} trường)
                </p>
                <div class="overflow-hidden rounded-md border border-dark-border">
                  <div
                    class="audit-diff-grid grid gap-2 bg-dark-surface/60 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted"
                  >
                    <span>Trường</span>
                    <span>Trước</span>
                    <span>Sau</span>
                  </div>
                  <div
                    v-for="row in auditDiffRows(event.beforeData, event.afterData, event.entityType)"
                    :key="row.key"
                    class="audit-diff-grid grid items-start gap-2 border-t border-dark-border px-3 py-2 text-xs"
                  >
                    <span class="truncate text-white/70">{{ row.label }}</span>
                    <pre class="min-w-0 whitespace-pre-wrap break-words font-mono text-error-vivid/90">{{ row.beforeText }}</pre>
                    <pre class="min-w-0 whitespace-pre-wrap break-words font-mono text-success-neon">{{ row.afterText }}</pre>
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

      <div v-if="hasMore" class="flex justify-center pt-1">
        <UiButton
          variant="secondary"
          :disabled="isLoadingMore"
          class="min-w-32"
          @click="loadMore()"
        >
          <IconRefresh v-if="isLoadingMore" class="h-4 w-4 animate-spin" aria-hidden="true" />
          {{ isLoadingMore ? 'Đang tải…' : 'Tải thêm' }}
        </UiButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.audit-diff-grid {
  grid-template-columns: minmax(7rem, 0.75fr) minmax(0, 1fr) minmax(0, 1fr);
}

@media (min-width: 40rem) {
  .audit-diff-grid {
    grid-template-columns: 10rem minmax(0, 1fr) minmax(0, 1fr);
  }
}
</style>
