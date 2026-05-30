<script setup lang="ts">
definePageMeta({ title: 'Nhập chỉ số đồng hồ' })

const route = useRoute()
const id = route.params.id as string

const { building } = useBuildingDetail(id)

const {
  roomsStatus,
  isLoading,
  isSaving,
  savedCount,
  saveErrors,
  periodYear,
  periodMonth,
  saveBulk,
} = useBuildingMeterReadings(id)

const saveSuccess = ref(false)

async function onSave(readings: Parameters<typeof saveBulk>[0]) {
  saveSuccess.value = false
  const ok = await saveBulk(readings)
  if (ok) saveSuccess.value = true
}
</script>

<template>
  <div>
    <div class="mb-6">
      <NuxtLink :to="`/buildings/${id}`" class="text-sm text-muted hover:text-white transition-colors">
        ← {{ building?.name ?? 'Tòa nhà' }}
      </NuxtLink>
      <h1 class="text-xl font-semibold text-white mt-2">Nhập chỉ số đồng hồ</h1>
    </div>

    <!-- Period selector -->
    <div class="flex items-center gap-3 mb-4">
      <label class="text-sm text-muted">Kỳ:</label>
      <select
        v-model="periodMonth"
        class="rounded border border-dark-border bg-dark-surface px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan/30"
      >
        <option v-for="m in 12" :key="m" :value="m">Tháng {{ m }}</option>
      </select>
      <input
        v-model="periodYear"
        type="number"
        min="2020"
        max="2100"
        class="w-24 rounded border border-dark-border bg-dark-surface px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan/30"
      >
    </div>

    <!-- Success / error messages -->
    <div v-if="saveSuccess" class="mb-4 rounded-lg border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-400">
      Đã lưu {{ savedCount }} chỉ số thành công.
    </div>
    <div v-if="saveErrors.length > 0" class="mb-4 rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
      {{ saveErrors[0] }}
    </div>

    <div class="rounded-xl border border-dark-border bg-dark-surface p-6">
      <div v-if="isLoading" class="space-y-2">
        <UiSkeleton class="h-10 w-full rounded" />
        <UiSkeleton class="h-10 w-full rounded" />
        <UiSkeleton class="h-10 w-full rounded" />
      </div>
      <MeterReadingBulkInput
        v-else
        :rooms-status="roomsStatus"
        :period-year="periodYear"
        :period-month="periodMonth"
        :is-saving="isSaving"
        @save="onSave"
      />
    </div>
  </div>
</template>
