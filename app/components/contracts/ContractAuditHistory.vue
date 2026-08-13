<script setup lang="ts">
import type { AuditEvent } from '~/types/audit'
import { formatRelativeTime } from '~/utils/format/relative-time'
import { formatDateTimeShort, formatTimeHHmm } from '~/utils/format/time'
import {
  auditActionLabel,
  auditActionVariant,
  auditActorLabel,
  auditDiffRows,
} from '~/utils/audit/display'

const props = defineProps<{
  contractId: string
  buildingId: string
}>()

const authStore = useAuthStore()
const { events, total, isLoading, error, refresh } = useContractAuditHistory(
  () => props.contractId,
  () => props.buildingId,
)

const now = ref(new Date())
const expandedId = ref<string | null>(null)
const canViewTechnicalJson = computed(() => authStore.isAdmin)
let nowInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  nowInterval = setInterval(() => {
    now.value = new Date()
  }, 30_000)
})

onUnmounted(() => {
  if (nowInterval) clearInterval(nowInterval)
})

function diffRows(event: AuditEvent) {
  return auditDiffRows(event.beforeData, event.afterData, event.entityType)
}

function toggleExpand(id: string) {
  if (!canViewTechnicalJson.value) return
  expandedId.value = expandedId.value === id ? null : id
}

function technicalJson(event: AuditEvent): string {
  const detail: Record<string, unknown> = {}
  if (event.beforeData !== null && event.beforeData !== undefined) detail.before = event.beforeData
  if (event.afterData !== null && event.afterData !== undefined) detail.after = event.afterData
  if (event.metadata && Object.keys(event.metadata).length > 0) detail.metadata = event.metadata
  return JSON.stringify(detail, null, 2)
}

defineExpose({ refresh })
</script>

<template>
  <div class="rounded-xl border border-ui-border bg-ui-surface p-4">
    <div class="mb-3 flex items-center justify-between gap-3">
      <div>
        <p class="text-sm font-medium text-ui-primary">Lịch sử thay đổi</p>
        <p class="mt-0.5 text-xs text-ui-muted">
          <template v-if="!isLoading">{{ events.length }} / {{ total }} sự kiện</template>
          <template v-else>Đang tải lịch sử...</template>
        </p>
      </div>
      <UiButton
        variant="ghost"
        size="sm"
        :disabled="isLoading"
        @click="refresh()"
      >
        Làm mới
      </UiButton>
    </div>

    <div v-if="isLoading" class="space-y-2">
      <UiSkeleton v-for="i in 3" :key="i" class="h-16 rounded-lg" />
    </div>

    <UiAlert v-else-if="error" severity="danger">
      Không thể tải lịch sử thay đổi hợp đồng.
    </UiAlert>

    <UiEmptyState
      v-else-if="events.length === 0"
      title="Chưa có lịch sử thay đổi"
      description="Các thay đổi trên hợp đồng sẽ được hiển thị tại đây."
    />

    <div v-else class="divide-y divide-ui-border overflow-hidden rounded-lg border border-ui-border">
      <article
        v-for="event in events"
        :key="event.id"
        class="bg-ui-deep"
      >
        <button
          type="button"
          class="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-ui-hover"
          :class="{ 'cursor-default hover:bg-transparent': !canViewTechnicalJson }"
          @click="toggleExpand(event.id)"
        >
          <span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-ui-accent" aria-hidden="true" />
          <span class="min-w-0 flex-1">
            <span class="flex flex-wrap items-center gap-2">
              <span class="text-sm font-medium text-ui-primary">{{ auditActionLabel(event.action) }}</span>
              <UiBadge :variant="auditActionVariant(event.action)" size="sm">
                {{ auditActionLabel(event.action) }}
              </UiBadge>
            </span>
            <span class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ui-muted">
              <span>{{ auditActorLabel(event) }}</span>
              <span :title="formatDateTimeShort(event.createdAt)">
                {{ formatRelativeTime(event.createdAt, now) }}
              </span>
            </span>
            <span v-if="diffRows(event).length > 0" class="mt-2 grid gap-1.5">
              <span
                v-for="row in diffRows(event).slice(0, 4)"
                :key="row.key"
                class="grid gap-2 text-xs sm:grid-cols-[9rem_minmax(0,1fr)]"
              >
                <span class="text-ui-muted">{{ row.label }}</span>
                <span class="min-w-0 break-words text-ui-primary">
                  <span class="text-status-danger/90">{{ row.beforeText }}</span>
                  <span class="px-1.5 text-ui-muted">-&gt;</span>
                  <span class="text-status-success">{{ row.afterText }}</span>
                </span>
              </span>
              <span v-if="diffRows(event).length > 4" class="text-xs text-ui-muted">
                +{{ diffRows(event).length - 4 }} trường khác
              </span>
            </span>
          </span>
          <span class="shrink-0 text-right">
            <span class="block text-xs font-medium text-ui-primary/80">{{ formatTimeHHmm(event.createdAt) }}</span>
            <IconChevronDown
              v-if="canViewTechnicalJson"
              class="ml-auto mt-2 h-4 w-4 text-ui-muted transition-transform"
              :class="{ 'rotate-180 text-ui-primary': expandedId === event.id }"
              aria-hidden="true"
            />
          </span>
        </button>

        <div v-if="canViewTechnicalJson && expandedId === event.id" class="border-t border-ui-border bg-ui-surface px-4 py-3">
          <pre class="max-h-72 overflow-auto rounded-md border border-ui-border bg-ui-deep p-3 text-xs text-ui-primary/70">{{ technicalJson(event) }}</pre>
        </div>
      </article>
    </div>
  </div>
</template>
