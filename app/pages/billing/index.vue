<script setup lang="ts">
definePageMeta({ title: 'Vận hành tháng' })

const route = useRoute()
const { buildings, isLoading } = useBuildingList()

const now = new Date()
const initialBuilding = typeof route.query.building === 'string' ? route.query.building : ''
const selectedBuildingId = ref<string>(initialBuilding)
const selectedYear = ref<number>(now.getFullYear())
const selectedMonth = ref<number>(now.getMonth() + 1)

const yearOptions = computed(() => {
  const current = now.getFullYear()
  return [current - 1, current, current + 1]
})
const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1)

const canContinue = computed(() => Boolean(selectedBuildingId.value))

const buildingSelectOptions = computed(() =>
  buildings.value.map(b => ({ value: b.id, label: b.name }))
)
const yearSelectOptions = computed(() =>
  yearOptions.value.map(y => ({ value: y, label: String(y) }))
)
const monthSelectOptions = computed(() =>
  monthOptions.map(m => ({ value: m, label: `Tháng ${m}` }))
)

function openMeterReadings() {
  if (!selectedBuildingId.value) return
  // For now, monthly entry lives on building-scoped meter-readings.
  // A full Monthly Billing Workspace at /billing/[building]/[period] will replace this once invoices land.
  navigateTo({
    path: `/buildings/${selectedBuildingId.value}/meter-readings`,
    query: { year: selectedYear.value, month: selectedMonth.value },
  })
}
</script>

<template>
  <div class="">
    <UiPageHeader title="Vận hành tháng" description="Chọn tòa nhà và kỳ thanh toán để bắt đầu nhập chỉ số đồng hồ và chuẩn bị số liệu cho hóa đơn." />

    <div class="rounded-xl border border-dark-border bg-dark-surface p-6 space-y-4">
      <UiSection title="Chọn tòa nhà">
        <UiSelect
          v-model="selectedBuildingId"
          :options="buildingSelectOptions"
          placeholder="— Chọn tòa nhà —"
          :disabled="isLoading"
          class="w-full"
        />
      </UiSection>

      <div class="grid grid-cols-2 gap-4">
        <UiSection title="Tháng">
          <UiSelect
            v-model="selectedMonth"
            :options="monthSelectOptions"
            class="w-full"
          />
        </UiSection>
        <UiSection title="Năm">
          <UiSelect
            v-model="selectedYear"
            :options="yearSelectOptions"
            class="w-full"
          />
        </UiSection>
      </div>

      <div class="pt-2">
        <UiButton :disabled="!canContinue" @click="openMeterReadings">
          Mở nhập chỉ số tháng {{ selectedMonth }}/{{ selectedYear }}
        </UiButton>
        <p class="text-xs text-muted mt-2">
          Tính năng sinh hóa đơn, đối soát thanh toán và theo dõi công nợ sẽ được bổ sung trong phiên bản tới.
          Hiện tại bước này chỉ thu thập số liệu đầu vào cho kỳ.
        </p>
      </div>
    </div>
  </div>
</template>
