<script setup lang="ts">
import type { Building } from '~/types/buildings'
import type { ApiSuccess } from '~/types/api'

definePageMeta({ title: 'Vận hành' })

const router = useRouter()

const { data: buildingData } = useFetch<ApiSuccess<Building[]>>('/api/buildings?limit=100', {
  default: () => ({ data: [] }),
})
const buildings = computed(() => buildingData.value?.data ?? [])

const { periods, isLoading, buildingFilter, yearFilter } = useBillingOverview()

// Create new period modal
const showCreateModal = ref(false)
const newBuildingId = ref('')
const newMonth = ref(new Date().getMonth() + 1)
const newYear = ref(new Date().getFullYear())

function openWorkspace(buildingId: string, year: number, month: number) {
  router.push(`/buildings/${buildingId}/billing?year=${year}&month=${month}`)
}

function createPeriod() {
  if (!newBuildingId.value) return
  openWorkspace(newBuildingId.value, newYear.value, newMonth.value)
  showCreateModal.value = false
}

function formatVnd(amount: number) {
  return new Intl.NumberFormat('vi-VN').format(amount)
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold text-white">Vận hành</h1>
        <p class="text-sm text-muted mt-1">Danh sách kỳ tính tiền theo tòa nhà</p>
      </div>
      <UiButton @click="showCreateModal = true">
        + Tạo kỳ tính tiền
      </UiButton>
    </div>

    <!-- Filters -->
    <div class="flex items-center gap-3">
      <select
        v-model="buildingFilter"
        class="rounded-md border border-dark-border bg-dark-surface px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan/30 focus:border-cyan/70"
      >
        <option value="">Tất cả tòa nhà</option>
        <option v-for="b in buildings" :key="b.id" :value="b.id">{{ b.name }}</option>
      </select>
      <input
        v-model.number="yearFilter"
        type="number"
        class="w-24 rounded-md border border-dark-border bg-dark-surface px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan/30 focus:border-cyan/70"
        min="2020"
        max="2099"
      >
    </div>

    <!-- Table -->
    <div v-if="isLoading" class="text-muted text-sm">Đang tải...</div>
    <div v-else-if="periods.length === 0" class="rounded-xl border border-dark-border bg-dark-surface p-8 text-center">
      <p class="text-muted">Chưa có kỳ tính tiền nào.</p>
      <p class="text-sm text-muted mt-1">Bấm "Tạo kỳ tính tiền" để bắt đầu.</p>
    </div>
    <div v-else class="overflow-x-auto rounded-xl border border-dark-border">
      <table class="min-w-full text-sm">
        <thead>
          <tr class="border-b border-dark-border bg-dark-surface text-muted text-xs">
            <th class="py-3 px-4 text-left">Tòa nhà</th>
            <th class="py-3 px-4 text-left">Kỳ</th>
            <th class="py-3 px-4 text-center">Trạng thái</th>
            <th class="py-3 px-4 text-right">Số phòng</th>
            <th class="py-3 px-4 text-right">Đã thu</th>
            <th class="py-3 px-4 text-right">Tổng tiền</th>
            <th class="py-3 px-4 text-center">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="p in periods"
            :key="p.id"
            class="border-b border-dark-border/50 hover:bg-dark-surface/50 cursor-pointer transition-colors"
            @click="openWorkspace(p.buildingId, p.periodYear, p.periodMonth)"
          >
            <td class="py-3 px-4 font-medium text-white">{{ p.buildingName }}</td>
            <td class="py-3 px-4 text-white">T{{ p.periodMonth }}/{{ p.periodYear }}</td>
            <td class="py-3 px-4 text-center">
              <BillingStatusBadge :status="p.status" />
            </td>
            <td class="py-3 px-4 text-right text-white">{{ p.itemCount }}</td>
            <td class="py-3 px-4 text-right">
              <span :class="p.paidCount === p.itemCount && p.itemCount > 0 ? 'text-success' : 'text-white'">
                {{ p.paidCount }}/{{ p.itemCount }}
              </span>
            </td>
            <td class="py-3 px-4 text-right text-white">{{ formatVnd(p.totalAmount) }}đ</td>
            <td class="py-3 px-4 text-center">
              <button
                class="text-cyan hover:text-cyan/80 text-xs font-medium"
                @click.stop="openWorkspace(p.buildingId, p.periodYear, p.periodMonth)"
              >
                Mở →
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create modal -->
    <div v-if="showCreateModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="showCreateModal = false">
      <div class="rounded-xl border border-dark-border bg-dark-card p-6 w-full max-w-md space-y-4">
        <h2 class="text-lg font-semibold text-white">Tạo kỳ tính tiền mới</h2>
        <div>
          <label class="block text-sm text-muted mb-1">Tòa nhà</label>
          <select
            v-model="newBuildingId"
            class="block w-full rounded-md border border-dark-border bg-dark-surface px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan/30 focus:border-cyan/70"
          >
            <option value="">— Chọn tòa nhà —</option>
            <option v-for="b in buildings" :key="b.id" :value="b.id">{{ b.name }}</option>
          </select>
        </div>
        <div class="flex gap-3">
          <div class="flex-1">
            <label class="block text-sm text-muted mb-1">Tháng</label>
            <select
              v-model="newMonth"
              class="block w-full rounded-md border border-dark-border bg-dark-surface px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan/30 focus:border-cyan/70"
            >
              <option v-for="m in 12" :key="m" :value="m">Tháng {{ m }}</option>
            </select>
          </div>
          <div class="flex-1">
            <label class="block text-sm text-muted mb-1">Năm</label>
            <input
              v-model.number="newYear"
              type="number"
              class="block w-full rounded-md border border-dark-border bg-dark-surface px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan/30 focus:border-cyan/70"
              min="2020"
              max="2099"
            >
          </div>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button
            class="px-4 py-2 text-sm text-muted hover:text-white transition-colors"
            @click="showCreateModal = false"
          >
            Hủy
          </button>
          <UiButton :disabled="!newBuildingId" @click="createPeriod">
            Mở billing workspace
          </UiButton>
        </div>
      </div>
    </div>
  </div>
</template>
