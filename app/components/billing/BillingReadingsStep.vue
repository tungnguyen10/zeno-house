<script setup lang="ts">
import type { UiTableColumn } from '~/components/ui/UiTable.vue'
import type { BillingPeriod, BillingUtilityUsage } from '~/types/billing'
import type { UtilityUsageOverrideInput } from '~/utils/validators/billing'
import { UTILITY_USAGE_REASONS } from '~/utils/constants/billing'

const props = defineProps<{
  period: BillingPeriod
  buildingId: string
  utilityUsages: BillingUtilityUsage[]
  utilityLoading: boolean
}>()

const emit = defineEmits<{
  reload: []
  saveOverride: [input: UtilityUsageOverrideInput]
}>()

const {
  roomsStatus,
  isLoading,
  isSaving,
  savedCount,
  saveErrors,
  periodYear,
  periodMonth,
  saveBulk,
} = useBuildingMeterReadings(props.buildingId)

// Force the bulk-input to read for THIS period
periodYear.value = props.period.periodYear
periodMonth.value = props.period.periodMonth

const saveSuccess = ref(false)

async function onSave(readings: Parameters<typeof saveBulk>[0]) {
  saveSuccess.value = false
  const ok = await saveBulk(readings)
  if (ok) {
    saveSuccess.value = true
    emit('reload')
  }
}

const reasonOptions = UTILITY_USAGE_REASONS.map(r => ({
  value: r,
  label: reasonLabel(r),
}))

function reasonLabel(r: string) {
  switch (r) {
    case 'normal': return 'Bình thường'
    case 'replacement': return 'Thay đồng hồ'
    case 'reset': return 'Reset'
    case 'correction': return 'Sửa số'
    case 'manual_adjustment': return 'Điều chỉnh thủ công'
    default: return r
  }
}

const overrideColumns: UiTableColumn<BillingUtilityUsage>[] = [
  { key: 'room', label: 'Phòng' },
  { key: 'meter', label: 'Loại đồng hồ', width: 'w-32' },
  { key: 'consumption', label: 'Số sử dụng', numeric: true },
  { key: 'reason', label: 'Lý do', width: 'w-36' },
  { key: 'note', label: 'Ghi chú', hideOnMobile: true },
]
</script>

<template>
  <div class="space-y-5">
    <UiSection title="Nhập chỉ số đồng hồ" :description="`Kỳ ${String(period.periodMonth).padStart(2, '0')}/${period.periodYear}`">
      <UiAlert v-if="saveSuccess" severity="success">
        Đã lưu {{ savedCount }} chỉ số.
      </UiAlert>
      <UiAlert v-if="saveErrors.length > 0" severity="danger">
        {{ saveErrors[0] }}
      </UiAlert>

      <div v-if="isLoading" class="space-y-2">
        <UiSkeleton class="h-10 w-full" />
        <UiSkeleton class="h-10 w-full" />
        <UiSkeleton class="h-10 w-full" />
      </div>
      <MeterReadingBulkInput
        v-else
        :rooms-status="roomsStatus"
        :period-year="periodYear"
        :period-month="periodMonth"
        :is-saving="isSaving"
        @save="onSave"
      />
    </UiSection>

    <UiSection
      title="Override số sử dụng"
      description="Áp dụng cho các trường hợp thay đồng hồ, reset, sửa số. Chỉnh sửa override sẽ được bổ sung trong bước sau."
    >
      <UiTable
        :rows="utilityUsages"
        :columns="overrideColumns"
        :loading="utilityLoading"
        empty-title="Chưa có override nào"
        empty-description="Khi nhập chỉ số bất thường (thay đồng hồ, reset...), bản ghi override sẽ hiển thị tại đây."
      >
        <template #cell-room="{ row }">{{ row.roomId }}</template>
        <template #cell-meter="{ row }">{{ row.meterType === 'electricity' ? 'Điện' : 'Nước' }}</template>
        <template #cell-consumption="{ row }">{{ row.billableUsage }}</template>
        <template #cell-reason="{ row }">{{ reasonLabel(row.reason) }}</template>
        <template #cell-note="{ row }">{{ row.note ?? '—' }}</template>
      </UiTable>
    </UiSection>

    <!-- emit/reasonOptions referenced for future override CTA; suppress unused warnings -->
    <span class="hidden">{{ reasonOptions.length }}{{ emit }}</span>
  </div>
</template>
