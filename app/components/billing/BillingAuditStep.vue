<script setup lang="ts">
import type { UiTableColumn } from '~/components/ui/UiTable.vue'
import type { BillingAuditEvent } from '~/types/billing'

defineProps<{
  events: BillingAuditEvent[]
  loading: boolean
}>()

defineEmits<{ (e: 'refresh'): void }>()

const expanded = ref<Set<string>>(new Set())

const columns: UiTableColumn<BillingAuditEvent>[] = [
  { key: 'createdAt', label: 'Thời điểm', width: 'w-40' },
  { key: 'actor', label: 'Người thực hiện', hideOnMobile: true, width: 'w-44' },
  { key: 'entity', label: 'Đối tượng', hideOnMobile: true },
  { key: 'summary', label: 'Chi tiết' },
]

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('vi-VN', { hour12: false })
  }
  catch {
    return iso
  }
}

function actorLabel(row: BillingAuditEvent): string {
  return row.actorName ?? row.actorEmail ?? (row.actorId ? 'Người dùng' : 'Hệ thống')
}

function toggleTechnical(id: string) {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}

function technicalJson(row: BillingAuditEvent): string {
  return JSON.stringify(row.metadata ?? {}, null, 2)
}
</script>

<template>
  <UiSection title="Nhật ký kỳ vận hành" description="Lịch sử thao tác trong kỳ.">
    <template #actions>
      <UiButton variant="secondary" size="sm" @click="$emit('refresh')">Làm mới</UiButton>
    </template>

    <UiTable
      :rows="events"
      :columns="columns"
      :loading="loading"
      empty-title="Chưa có sự kiện nào"
      empty-description="Audit log sẽ tự động ghi lại khi có thao tác trong kỳ này."
    >
      <template #cell-createdAt="{ row }">{{ formatTime(row.createdAt) }}</template>

      <template #cell-actor="{ row }">
        <span :title="row.actorEmail ?? undefined">{{ actorLabel(row) }}</span>
      </template>

      <template #cell-entity="{ row }">
        <NuxtLink
          v-if="row.entityHref"
          :to="row.entityHref"
          class="block text-white hover:text-cyan"
        >
          <span class="block text-sm">{{ row.entityLabel ?? row.entityType }}</span>
          <span v-if="row.entitySubLabel" class="block text-xs text-muted">{{ row.entitySubLabel }}</span>
        </NuxtLink>
        <span v-else class="block">
          <span class="block text-sm text-white">{{ row.entityLabel ?? row.entityType }}</span>
          <span v-if="row.entitySubLabel" class="block text-xs text-muted">{{ row.entitySubLabel }}</span>
        </span>
      </template>

      <template #cell-summary="{ row }">
        <div class="space-y-2">
          <p class="text-sm text-white">{{ row.summary ?? `Hành động: ${row.action}` }}</p>
          <UiButton
            variant="ghost"
            size="sm"
            class="!h-auto !px-0 !py-0 !text-xs !text-muted hover:!text-white"
            @click="toggleTechnical(row.id)"
          >
            Chi tiết kỹ thuật
          </UiButton>
          <pre
            v-if="expanded.has(row.id)"
            class="max-h-48 overflow-auto rounded-md border border-dark-border bg-dark-surface p-2 text-xs text-muted"
          >{{ technicalJson(row) }}</pre>
        </div>
      </template>
    </UiTable>
  </UiSection>
</template>
