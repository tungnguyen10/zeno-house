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
    <div class="mb-6">
      <h1 class="text-xl font-semibold text-white">Vận hành tháng</h1>
      <p class="text-sm text-muted mt-1">
        Chọn tòa nhà và kỳ thanh toán để bắt đầu nhập chỉ số đồng hồ và chuẩn bị số liệu cho hóa đơn.
        Mọi tác vụ tính tiền hàng tháng sẽ diễn ra trong không gian làm việc theo Tòa nhà + Kỳ, không phải trên từng phòng.
      </p>
    </div>

    <div class="rounded-xl border border-dark-border bg-dark-surface p-6 space-y-4">
      <div>
        <label class="block text-xs text-muted mb-1.5">Tòa nhà</label>
        <select
          v-model="selectedBuildingId"
          class="w-full rounded-lg border border-dark-border bg-dark-bg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan/60"
          :disabled="isLoading"
        >
          <option value="">— Chọn tòa nhà —</option>
          <option v-for="b in buildings" :key="b.id" :value="b.id">{{ b.name }}</option>
        </select>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-xs text-muted mb-1.5">Tháng</label>
          <select
            v-model.number="selectedMonth"
            class="w-full rounded-lg border border-dark-border bg-dark-bg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan/60"
          >
            <option v-for="m in monthOptions" :key="m" :value="m">Tháng {{ m }}</option>
          </select>
        </div>
        <div>
          <label class="block text-xs text-muted mb-1.5">Năm</label>
          <select
            v-model.number="selectedYear"
            class="w-full rounded-lg border border-dark-border bg-dark-bg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan/60"
          >
            <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option>
          </select>
        </div>
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
