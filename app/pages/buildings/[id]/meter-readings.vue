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

const monthOptions = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `Tháng ${i + 1}` }))

async function onSave(readings: Parameters<typeof saveBulk>[0]) {
  saveSuccess.value = false
  const ok = await saveBulk(readings)
  if (ok) saveSuccess.value = true
}
</script>

<template>
  <div>
    <UiPageHeader title="Nhập chỉ số đồng hồ">
      <NuxtLink :to="`/buildings/${id}`" class="text-sm text-muted hover:text-white transition-colors">
        ← {{ building?.name ?? 'Tòa nhà' }}
      </NuxtLink>
    </UiPageHeader>

    <!-- Period selector -->
    <div class="flex items-center gap-3 mb-4">
      <label class="text-sm text-muted">Kỳ:</label>
      <UiSelect
        v-model="periodMonth"
        :options="monthOptions"
        class="w-36"
      />
      <UiInput
        v-model="periodYear"
        type="number"
        min="2020"
        max="2100"
        class="w-24"
      />
    </div>

    <!-- Success / error messages -->
    <UiAlert v-if="saveSuccess" severity="success" class="mb-4">
      Đã lưu {{ savedCount }} chỉ số thành công.
    </UiAlert>
    <UiAlert v-if="saveErrors.length > 0" severity="danger" class="mb-4">
      {{ saveErrors[0] }}
    </UiAlert>

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
