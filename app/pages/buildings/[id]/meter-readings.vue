<script setup lang="ts">
import type { RoomMeterStatus } from '~/types/meter-readings'
import type { UiTableColumn } from '~/components/ui/UiTable.vue'
import { buildingPath, billingWorkspacePath } from '~/utils/routes/operational'

definePageMeta({ title: 'Chỉ số đồng hồ' })

const route = useRoute()
const id = route.params.id as string

const { building } = useBuildingDetail(id)

const {
  roomsStatus,
  isLoading,
  periodYear,
  periodMonth,
} = useBuildingMeterReadings(id)

const { monthOptions } = usePeriodOptions({
  selectedYear: periodYear,
})

interface MeterCell {
  previousValue: number | null
  currentValue: number | null
  consumption: number | null
  hasReading: boolean
}

interface RoomRow {
  key: string
  roomId: string
  roomNumber: string
  floor: number
  electricity: MeterCell
  water: MeterCell
  readingDate: string | null
  isComplete: boolean
  isPartial: boolean
}

function buildMeterCell(
  prev: number | null | undefined,
  curr: number | null | undefined,
): MeterCell {
  const previousValue = prev ?? null
  const currentValue = curr ?? null
  const consumption
    = previousValue !== null && currentValue !== null
      ? Math.max(0, currentValue - previousValue)
      : null
  return {
    previousValue,
    currentValue,
    consumption,
    hasReading: currentValue !== null,
  }
}

const rows = computed<RoomRow[]>(() =>
  roomsStatus.value.map((room: RoomMeterStatus) => {
    const elec = room.devices.find(d => d.meterType === 'electricity')
    const wat = room.devices.find(d => d.meterType === 'water')
    const electricity = buildMeterCell(
      elec?.previousReading?.readingValue,
      elec?.existingReading?.readingValue,
    )
    const water = buildMeterCell(
      wat?.previousReading?.readingValue,
      wat?.existingReading?.readingValue,
    )
    const readingDate
      = elec?.existingReading?.readingDate ?? wat?.existingReading?.readingDate ?? null
    return {
      key: room.roomId,
      roomId: room.roomId,
      roomNumber: room.roomNumber,
      floor: room.floor,
      electricity,
      water,
      readingDate,
      isComplete: electricity.hasReading && water.hasReading,
      isPartial:
        (electricity.hasReading || water.hasReading)
        && !(electricity.hasReading && water.hasReading),
    }
  }),
)

const summary = computed(() => {
  const total = rows.value.length
  const complete = rows.value.filter(r => r.isComplete).length
  const partial = rows.value.filter(r => r.isPartial).length
  const electricityUsage = rows.value.reduce(
    (sum, r) => sum + (r.electricity.consumption ?? 0),
    0,
  )
  const waterUsage = rows.value.reduce((sum, r) => sum + (r.water.consumption ?? 0), 0)
  return { total, complete, partial, electricityUsage, waterUsage }
})

const columns: UiTableColumn<RoomRow>[] = [
  { key: 'roomNumber', label: 'Phòng' },
  { key: 'electricity', label: 'Điện (kWh)', numeric: true, width: 'w-48' },
  { key: 'water', label: 'Nước (m³)', numeric: true, width: 'w-48' },
  { key: 'readingDate', label: 'Ngày đọc', hideOnMobile: true },
  { key: 'status', label: 'Trạng thái' },
]

const billingHref = computed(() =>
  building.value
    ? billingWorkspacePath(building.value, periodYear.value, periodMonth.value)
    : null,
)

const backHref = computed(() => (building.value ? buildingPath(building.value) : `/buildings/${id}`))
const backLabel = computed(() => building.value?.name ?? 'Tòa nhà')

const periodLabel = computed(
  () => `Tháng ${String(periodMonth.value).padStart(2, '0')}/${periodYear.value}`,
)

function formatNumber(value: number | null): string {
  return value !== null ? value.toLocaleString('vi-VN') : '—'
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (isNaN(d.getTime())) return value
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
</script>

<template>
  <div>
    <UiPageHeader
      title="Chỉ số đồng hồ"
      :description="`Xem nhanh chỉ số điện / nước theo kỳ. Nhập hoặc chỉnh sửa tại workspace billing.`"
      :back-to="backHref"
      :back-label="backLabel"
    >
      <template #actions>
        <NuxtLink v-if="billingHref" :to="billingHref">
          <UiButton variant="primary" size="sm">
            Nhập / chỉnh ở Billing
          </UiButton>
        </NuxtLink>
      </template>
    </UiPageHeader>

    <!-- KPI strip -->
    <div class="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
      <div class="rounded-xl border border-dark-border bg-dark-surface px-4 py-3">
        <p class="text-xs uppercase tracking-wide text-muted">Phòng đang hoạt động</p>
        <p class="mt-1 text-xl font-semibold tabular-nums text-white">{{ summary.total }}</p>
      </div>
      <div class="rounded-xl border border-dark-border bg-dark-surface px-4 py-3">
        <p class="text-xs uppercase tracking-wide text-muted">Đã chốt</p>
        <p class="mt-1 text-xl font-semibold tabular-nums text-success-neon">
          {{ summary.complete }}<span class="text-sm font-normal text-muted">/{{ summary.total }}</span>
        </p>
        <p v-if="summary.partial > 0" class="mt-0.5 text-[11px] text-muted">
          {{ summary.partial }} phòng chỉ chốt 1 đồng hồ
        </p>
      </div>
      <div class="rounded-xl border border-dark-border bg-dark-surface px-4 py-3">
        <p class="text-xs uppercase tracking-wide text-muted">Tổng tiêu thụ điện</p>
        <p class="mt-1 text-xl font-semibold tabular-nums text-cyan">
          {{ formatNumber(summary.electricityUsage) }}
          <span class="text-sm font-normal text-muted">kWh</span>
        </p>
      </div>
      <div class="rounded-xl border border-dark-border bg-dark-surface px-4 py-3">
        <p class="text-xs uppercase tracking-wide text-muted">Tổng tiêu thụ nước</p>
        <p class="mt-1 text-xl font-semibold tabular-nums text-cyan">
          {{ formatNumber(summary.waterUsage) }}
          <span class="text-sm font-normal text-muted">m³</span>
        </p>
      </div>
    </div>

    <!-- Period selector -->
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <label class="text-sm text-muted">Kỳ:</label>
      <UiSelect
        v-model="periodMonth"
        :options="monthOptions"
        aria-label="Tháng xem chỉ số"
        class="w-36"
      />
      <UiInput
        v-model="periodYear"
        type="number"
        number-mode="year"
        min="2020"
        max="2100"
        class="w-24"
      />
      <span class="text-xs text-muted">{{ periodLabel }}</span>
    </div>

    <!-- Desktop table -->
    <div class="hidden rounded-xl border border-dark-border bg-dark-surface md:block">
      <UiTable
        :rows="rows"
        :columns="columns"
        row-key="key"
        :loading="isLoading"
        empty-title="Chưa có phòng nào đang hoạt động hoặc chưa gắn đồng hồ"
      >
        <template #cell-roomNumber="{ row }">
          <div class="flex items-baseline gap-1.5">
            <span class="font-medium text-white">{{ row.roomNumber }}</span>
            <span class="text-xs text-muted">T{{ row.floor }}</span>
          </div>
        </template>

        <template #cell-electricity="{ row }">
          <div class="flex flex-col items-end gap-0.5">
            <span
              class="text-sm tabular-nums"
              :class="row.electricity.hasReading ? 'text-white' : 'text-muted'"
            >
              {{ formatNumber(row.electricity.currentValue) }}
            </span>
            <p class="text-[11px] leading-tight text-muted tabular-nums">
              Kỳ trước · {{ formatNumber(row.electricity.previousValue) }}
            </p>
            <p v-if="row.electricity.consumption !== null" class="text-[11px] leading-tight text-cyan tabular-nums">
              +{{ formatNumber(row.electricity.consumption) }} kWh
            </p>
          </div>
        </template>

        <template #cell-water="{ row }">
          <div class="flex flex-col items-end gap-0.5">
            <span
              class="text-sm tabular-nums"
              :class="row.water.hasReading ? 'text-white' : 'text-muted'"
            >
              {{ formatNumber(row.water.currentValue) }}
            </span>
            <p class="text-[11px] leading-tight text-muted tabular-nums">
              Kỳ trước · {{ formatNumber(row.water.previousValue) }}
            </p>
            <p v-if="row.water.consumption !== null" class="text-[11px] leading-tight text-cyan tabular-nums">
              +{{ formatNumber(row.water.consumption) }} m³
            </p>
          </div>
        </template>

        <template #cell-readingDate="{ row }">
          <span class="text-xs text-muted">{{ formatDate(row.readingDate) }}</span>
        </template>

        <template #cell-status="{ row }">
          <span
            v-if="row.isComplete"
            class="inline-flex items-center gap-1 rounded-full bg-success-neon/10 px-2 py-0.5 text-xs font-medium text-success-neon"
          >
            <span class="h-1.5 w-1.5 rounded-full bg-success-neon" />
            Đã chốt
          </span>
          <span
            v-else-if="row.isPartial"
            class="inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-2 py-0.5 text-xs font-medium text-amber-300"
          >
            <span class="h-1.5 w-1.5 rounded-full bg-amber-300" />
            Một phần
          </span>
          <span
            v-else
            class="inline-flex items-center gap-1 rounded-full bg-dark-hover px-2 py-0.5 text-xs text-muted"
          >
            <span class="h-1.5 w-1.5 rounded-full bg-muted/50" />
            Chưa chốt
          </span>
        </template>
      </UiTable>
    </div>

    <!-- Mobile stacked cards -->
    <div class="space-y-2 md:hidden">
      <div v-if="isLoading" class="space-y-2">
        <UiSkeleton class="h-24 w-full rounded-xl" />
        <UiSkeleton class="h-24 w-full rounded-xl" />
        <UiSkeleton class="h-24 w-full rounded-xl" />
      </div>
      <p
        v-else-if="rows.length === 0"
        class="rounded-xl border border-dark-border bg-dark-surface p-6 text-center text-sm text-muted"
      >
        Chưa có phòng nào đang hoạt động hoặc chưa gắn đồng hồ.
      </p>
      <article
        v-for="row in rows"
        v-else
        :key="row.key"
        class="rounded-xl border border-dark-border bg-dark-surface p-4"
      >
        <header class="mb-3 flex items-center justify-between">
          <div class="flex items-baseline gap-1.5">
            <span class="font-medium text-white">{{ row.roomNumber }}</span>
            <span class="text-xs text-muted">T{{ row.floor }}</span>
          </div>
          <span
            v-if="row.isComplete"
            class="inline-flex items-center gap-1 rounded-full bg-success-neon/10 px-2 py-0.5 text-[11px] font-medium text-success-neon"
          >
            Đã chốt
          </span>
          <span
            v-else-if="row.isPartial"
            class="inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-2 py-0.5 text-[11px] font-medium text-amber-300"
          >
            Một phần
          </span>
          <span
            v-else
            class="inline-flex items-center gap-1 rounded-full bg-dark-hover px-2 py-0.5 text-[11px] text-muted"
          >
            Chưa chốt
          </span>
        </header>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p class="text-[11px] uppercase tracking-wide text-muted">Điện</p>
            <p class="tabular-nums" :class="row.electricity.hasReading ? 'text-white' : 'text-muted'">
              {{ formatNumber(row.electricity.currentValue) }}
              <span class="text-xs text-muted">kWh</span>
            </p>
            <p class="text-[11px] text-muted tabular-nums">
              Kỳ trước · {{ formatNumber(row.electricity.previousValue) }}
            </p>
            <p v-if="row.electricity.consumption !== null" class="text-[11px] text-cyan tabular-nums">
              +{{ formatNumber(row.electricity.consumption) }} kWh
            </p>
          </div>
          <div>
            <p class="text-[11px] uppercase tracking-wide text-muted">Nước</p>
            <p class="tabular-nums" :class="row.water.hasReading ? 'text-white' : 'text-muted'">
              {{ formatNumber(row.water.currentValue) }}
              <span class="text-xs text-muted">m³</span>
            </p>
            <p class="text-[11px] text-muted tabular-nums">
              Kỳ trước · {{ formatNumber(row.water.previousValue) }}
            </p>
            <p v-if="row.water.consumption !== null" class="text-[11px] text-cyan tabular-nums">
              +{{ formatNumber(row.water.consumption) }} m³
            </p>
          </div>
        </div>
        <footer v-if="row.readingDate" class="mt-3 border-t border-dark-border pt-2 text-[11px] text-muted">
          Ngày đọc: {{ formatDate(row.readingDate) }}
        </footer>
      </article>
    </div>
  </div>
</template>
