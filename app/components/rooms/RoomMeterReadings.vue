<script setup lang="ts">
const props = defineProps<{
  roomId: string
}>()

const { readings, isLoading } = useMeterReadings(props.roomId)

const electricityReadings = computed(() =>
  readings.value.filter(r => r.meterType === 'electricity'),
)
const waterReadings = computed(() =>
  readings.value.filter(r => r.meterType === 'water'),
)

const readingTypeLabel: Record<string, string> = {
  monthly: 'Định kỳ',
  handover_in: 'Bàn giao vào',
  handover_out: 'Bàn giao ra',
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="isLoading" class="space-y-2">
      <UiSkeleton class="h-8 w-full rounded" />
      <UiSkeleton class="h-8 w-full rounded" />
    </div>

    <template v-else-if="readings.length > 0">
      <!-- Điện -->
      <div v-if="electricityReadings.length > 0">
        <p class="text-xs font-medium text-muted uppercase tracking-wide mb-2">Điện</p>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-dark-border">
                <th class="text-left text-xs text-muted pb-2 pr-4">Kỳ</th>
                <th class="text-left text-xs text-muted pb-2 pr-4">Loại</th>
                <th class="text-right text-xs text-muted pb-2 pr-4">Chỉ số</th>
                <th class="text-left text-xs text-muted pb-2">Ngày đọc</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-dark-border">
              <tr v-for="r in electricityReadings" :key="r.id">
                <td class="py-2 pr-4 text-white">{{ r.periodMonth }}/{{ r.periodYear }}</td>
                <td class="py-2 pr-4 text-muted">{{ readingTypeLabel[r.readingType] }}</td>
                <td class="py-2 pr-4 text-right text-white">{{ r.readingValue.toLocaleString('vi-VN') }}</td>
                <td class="py-2 text-muted">{{ new Date(r.readingDate).toLocaleDateString('vi-VN') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Nước -->
      <div v-if="waterReadings.length > 0">
        <p class="text-xs font-medium text-muted uppercase tracking-wide mb-2">Nước</p>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-dark-border">
                <th class="text-left text-xs text-muted pb-2 pr-4">Kỳ</th>
                <th class="text-left text-xs text-muted pb-2 pr-4">Loại</th>
                <th class="text-right text-xs text-muted pb-2 pr-4">Chỉ số</th>
                <th class="text-left text-xs text-muted pb-2">Ngày đọc</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-dark-border">
              <tr v-for="r in waterReadings" :key="r.id">
                <td class="py-2 pr-4 text-white">{{ r.periodMonth }}/{{ r.periodYear }}</td>
                <td class="py-2 pr-4 text-muted">{{ readingTypeLabel[r.readingType] }}</td>
                <td class="py-2 pr-4 text-right text-white">{{ r.readingValue.toLocaleString('vi-VN') }}</td>
                <td class="py-2 text-muted">{{ new Date(r.readingDate).toLocaleDateString('vi-VN') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <p v-else class="text-sm text-muted">Chưa có chỉ số nào được ghi nhận.</p>
  </div>
</template>
