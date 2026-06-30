<script setup lang="ts">
import clsx from 'clsx'
import type { AuditEntityType } from '~/utils/constants/audit'
import { formatRelativeTime } from '~/utils/format/relative-time'
import { formatDateTimeShort } from '~/utils/format/time'

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
}

function actionVariant(action: string): 'success' | 'accent' | 'danger' | 'warning' | 'neutral' {
  if (action.endsWith('.created') || action.endsWith('.activated')) return 'success'
  if (action.endsWith('.updated') || action.endsWith('.renewed')) return 'accent'
  if (action.endsWith('.removed') || action.endsWith('.terminated')) return 'danger'
  if (action.endsWith('.archived') || action.endsWith('.maintenance_set') || action.endsWith('.expired')) return 'warning'
  return 'neutral'
}

function actionLabel(action: string): string {
  const suffix = action.split('.').pop() ?? action
  const labels: Record<string, string> = {
    created: 'Tạo mới',
    updated: 'Cập nhật',
    removed: 'Xóa',
    archived: 'Lưu trữ',
    activated: 'Kích hoạt',
    terminated: 'Chấm dứt',
    expired: 'Hết hạn',
    renewed: 'Gia hạn',
    maintenance_set: 'Bảo trì',
  }
  return labels[suffix] ?? suffix
}

function entityColor(entityType: string): string {
  return clsx({
    'bg-cyan/20 text-cyan': entityType === 'building',
    'bg-violet-500/20 text-violet-300': entityType === 'room',
    'bg-blue-500/20 text-blue-300': entityType === 'tenant',
    'bg-amber-500/20 text-amber-300': entityType === 'contract',
    'bg-emerald-500/20 text-emerald-300': entityType === 'contract_renewal',
    'bg-muted/20 text-muted': !['building', 'room', 'tenant', 'contract', 'contract_renewal'].includes(entityType),
  })
}

const expandedId = ref<string | null>(null)
function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}
</script>

<template>
  <div class="space-y-5">
    <UiPageHeader
      title="Audit Log"
      description="Lịch sử thay đổi dữ liệu master — ai đã làm gì với tòa nhà, phòng, khách thuê, hợp đồng."
    />

    <!-- Toolbar -->
    <div class="flex flex-wrap items-center gap-3">
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
      <button
        type="button"
        class="ml-auto inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-muted transition-colors hover:bg-dark-hover hover:text-white"
        :class="{ 'opacity-50 pointer-events-none': isLoading }"
        @click="refresh()"
      >
        <IconRefresh class="h-4 w-4" :class="{ 'animate-spin': isLoading }" aria-hidden="true" />
        Làm mới
      </button>
    </div>

    <!-- Count -->
    <p v-if="!isLoading" class="text-xs text-muted">
      Hiển thị {{ events.length }} / {{ total }} sự kiện
    </p>

    <!-- Loading skeleton -->
    <div v-if="isLoading" class="space-y-2">
      <UiSkeleton v-for="i in 8" :key="i" class="h-14 w-full" />
    </div>

    <!-- Empty state -->
    <UiEmptyState
      v-else-if="events.length === 0"
      title="Chưa có sự kiện nào"
      description="Thực hiện một thao tác (tạo, cập nhật, xóa) để xem log tại đây."
    />

    <!-- Event list -->
    <div v-else class="overflow-hidden rounded-lg border border-dark-border">
      <div
        v-for="event in events"
        :key="event.id"
        class="border-b border-dark-border last:border-b-0"
      >
        <!-- Main row -->
        <button
          type="button"
          class="grid w-full grid-cols-[auto_1fr_auto] items-start gap-4 px-4 py-3 text-left transition-colors hover:bg-dark-hover"
          :class="{ 'bg-dark-hover': expandedId === event.id }"
          @click="toggleExpand(event.id)"
        >
          <!-- Action indicator bar -->
          <span
            class="mt-1 h-8 w-1 shrink-0 rounded-full"
            :class="{
              'bg-success-neon': actionVariant(event.action) === 'success',
              'bg-cyan': actionVariant(event.action) === 'accent',
              'bg-error-vivid': actionVariant(event.action) === 'danger',
              'bg-warning': actionVariant(event.action) === 'warning',
              'bg-dark-border': actionVariant(event.action) === 'neutral',
            }"
            aria-hidden="true"
          />

          <!-- Content -->
          <div class="min-w-0 space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              <!-- Entity type chip -->
              <span
                class="rounded px-1.5 py-0.5 text-xs font-medium"
                :class="entityColor(event.entityType)"
              >
                {{ entityTypeLabels[event.entityType] ?? event.entityType }}
              </span>
              <!-- Action badge -->
              <UiBadge :variant="actionVariant(event.action)">
                {{ actionLabel(event.action) }}
              </UiBadge>
              <!-- Entity ID (truncated) -->
              <span v-if="event.entityId" class="truncate font-mono text-xs text-muted">
                {{ event.entityId.slice(0, 8) }}…
              </span>
            </div>
            <p class="text-xs text-muted">
              <span v-if="event.actorId">Actor: {{ event.actorId.slice(0, 8) }}…</span>
              <span v-else class="italic">Hệ thống</span>
              <span v-if="event.correlationId" class="ml-2 opacity-60">· bulk</span>
            </p>
          </div>

          <!-- Timestamp -->
          <div class="shrink-0 text-right">
            <p class="text-xs text-muted" :title="formatDateTimeShort(event.createdAt)">
              {{ formatRelativeTime(event.createdAt, now) }}
            </p>
          </div>
        </button>

        <!-- Expanded: before / after -->
        <div v-if="expandedId === event.id" class="border-t border-dark-border bg-dark-deep px-4 py-3">
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <p class="mb-1 text-xs font-semibold text-muted">Before</p>
              <pre
                v-if="event.beforeData"
                class="max-h-48 overflow-auto rounded bg-dark-surface p-2 text-xs text-white/80"
              >{{ JSON.stringify(event.beforeData, null, 2) }}</pre>
              <p v-else class="text-xs italic text-muted">—</p>
            </div>
            <div>
              <p class="mb-1 text-xs font-semibold text-muted">After</p>
              <pre
                v-if="event.afterData"
                class="max-h-48 overflow-auto rounded bg-dark-surface p-2 text-xs text-white/80"
              >{{ JSON.stringify(event.afterData, null, 2) }}</pre>
              <p v-else class="text-xs italic text-muted">—</p>
            </div>
          </div>
          <div v-if="event.metadata && Object.keys(event.metadata).length" class="mt-3">
            <p class="mb-1 text-xs font-semibold text-muted">Metadata</p>
            <pre class="max-h-24 overflow-auto rounded bg-dark-surface p-2 text-xs text-white/60">{{ JSON.stringify(event.metadata, null, 2) }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
