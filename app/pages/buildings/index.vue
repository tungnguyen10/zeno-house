<script setup lang="ts">
import type { BuildingBulkAction, BuildingBulkResult } from '~/composables/buildings/useBuildingBulkActions'

const authStore = useAuthStore()
const toast = useToast()
const {
  buildings,
  total,
  totalPages,
  page,
  q,
  status,
  sort,
  order,
  hasActiveFilters,
  resetFilters,
  isLoading,
  error,
  refresh,
} = useBuildingList()

const bulk = useBuildingBulkActions()

const selectionMode = ref(false)

function toggleSelectionMode() {
  selectionMode.value = !selectionMode.value
  if (!selectionMode.value) bulk.clear()
}

function onToggleSelect(id: string) {
  bulk.toggle(id)
}

const allOnPageSelected = computed(() => {
  if (buildings.value.length === 0) return false
  return buildings.value.every(b => bulk.selectedIds.value.includes(b.id))
})

const someOnPageSelected = computed(() =>
  buildings.value.some(b => bulk.selectedIds.value.includes(b.id)),
)

function toggleAllOnPage(checked: boolean) {
  if (checked) {
    const merged = new Set([...bulk.selectedIds.value, ...buildings.value.map(b => b.id)])
    bulk.selectAll([...merged])
  }
  else {
    const pageIds = new Set(buildings.value.map(b => b.id))
    bulk.selectAll(bulk.selectedIds.value.filter(id => !pageIds.has(id)))
  }
}

// Failure detail modal ----------------------------------------------------
const failureModalOpen = ref(false)
const lastFailures = ref<BuildingBulkResult['failed']>([])
const lastFailureAction = ref<BuildingBulkAction | null>(null)

const reasonLabels: Record<string, string> = {
  has_rooms: 'Còn phòng',
  has_active_contracts: 'Còn hợp đồng đang hoạt động',
  not_found: 'Không tìm thấy',
  conflict: 'Xung đột dữ liệu',
}

const failuresWithName = computed(() => {
  const map = new Map(buildings.value.map(b => [b.id, b.name]))
  return lastFailures.value.map(f => ({
    id: f.id,
    name: map.get(f.id) ?? f.id,
    reason: reasonLabels[f.reason] ?? f.reason,
  }))
})

const lastActionVerb = computed(() =>
  lastFailureAction.value === 'archive'
    ? 'lưu trữ'
    : lastFailureAction.value === 'activate'
      ? 'kích hoạt'
      : 'xoá',
)

async function onBulkDone(result: BuildingBulkResult, action: BuildingBulkAction) {
  const verb = action === 'archive' ? 'lưu trữ' : action === 'activate' ? 'kích hoạt' : 'xoá'
  const succeeded = result.succeeded.length
  const failed = result.failed.length

  lastFailures.value = result.failed
  lastFailureAction.value = action

  if (succeeded > 0 && failed === 0) toast.success(`Đã ${verb} ${succeeded} toà nhà`)
  else if (succeeded > 0 && failed > 0) toast.info(`Đã ${verb} ${succeeded} toà, ${failed} toà bị bỏ qua`)
  else if (failed > 0) toast.error(`Không thể ${verb}. ${failed} toà bị bỏ qua`)

  bulk.clear()
  await refresh()
}
</script>

<template>
  <div>
    <UiPageHeader title="Tòa nhà" :description="`${total} tòa nhà`">
      <template #actions>
        <div class="flex items-center gap-2">
          <UiButton
            v-if="authStore.isAdmin"
            variant="secondary"
            size="sm"
            @click="toggleSelectionMode"
          >
            {{ selectionMode ? 'Thoát chọn' : 'Chọn nhiều' }}
          </UiButton>
          <NuxtLink v-if="authStore.isAdmin" to="/buildings/create">
            <UiButton>Thêm tòa nhà</UiButton>
          </NuxtLink>
        </div>
      </template>
    </UiPageHeader>

    <BuildingListToolbar
      v-model:q="q"
      v-model:status="status"
      v-model:sort="sort"
      v-model:order="order"
      :has-active-filters="hasActiveFilters"
      class="mb-4"
      @reset="resetFilters"
    />

    <UiAlert v-if="lastFailures.length > 0" severity="warning" class="mb-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <span class="text-sm">
          {{ lastFailures.length }} toà bị bỏ qua trong lần {{ lastActionVerb }} gần nhất.
        </span>
        <div class="flex items-center gap-2">
          <UiButton size="sm" variant="secondary" @click="failureModalOpen = true">
            Xem chi tiết
          </UiButton>
          <UiButton size="sm" variant="ghost" @click="lastFailures = []">Đóng</UiButton>
        </div>
      </div>
    </UiAlert>

    <div v-if="isLoading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <UiSkeleton v-for="n in 6" :key="n" class="h-36 rounded-xl" />
    </div>

    <UiAlert v-else-if="error" severity="danger">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <span>Không thể tải danh sách tòa nhà.</span>
        <UiButton variant="secondary" size="sm" @click="refresh()">Thử lại</UiButton>
      </div>
    </UiAlert>

    <UiEmptyState
      v-else-if="buildings.length === 0 && hasActiveFilters"
      variant="search"
      title="Không tìm thấy tòa nhà phù hợp"
      description="Thử bỏ bớt bộ lọc hoặc thay đổi từ khoá tìm kiếm."
    >
      <template #action>
        <UiButton variant="secondary" @click="resetFilters">Xoá bộ lọc</UiButton>
      </template>
    </UiEmptyState>

    <UiEmptyState
      v-else-if="buildings.length === 0"
      title="Chưa có tòa nhà nào"
      description="Bắt đầu bằng cách thêm tòa nhà đầu tiên của bạn."
    >
      <template v-if="authStore.isAdmin" #action>
        <NuxtLink to="/buildings/create">
          <UiButton>Thêm tòa nhà đầu tiên</UiButton>
        </NuxtLink>
      </template>
    </UiEmptyState>

    <template v-else>
      <div
        v-if="selectionMode && authStore.isAdmin"
        class="mb-3 flex items-center justify-between gap-3 rounded-lg border border-dark-border bg-dark-deep/40 px-3 py-2"
      >
        <UiCheckbox
          :model-value="allOnPageSelected"
          :indeterminate="someOnPageSelected && !allOnPageSelected"
          :label="`Chọn cả trang (${buildings.length})`"
          @update:model-value="toggleAllOnPage"
        />
        <span class="text-xs text-muted">{{ bulk.selectedIds.value.length }} đã chọn tổng cộng</span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <BuildingCard
          v-for="building in buildings"
          :key="building.id"
          :building="building"
          :selectable="selectionMode && authStore.isAdmin"
          :selected="bulk.selectedIds.value.includes(building.id)"
          @toggle-select="onToggleSelect"
        />
      </div>

      <div v-if="totalPages > 1" class="flex items-center justify-between mt-6 pt-4 border-t border-dark-border">
        <p class="text-sm text-muted">Trang {{ page }} / {{ totalPages }}</p>
        <div class="flex gap-2">
          <UiButton variant="secondary" size="sm" :disabled="page <= 1" @click="page--">
            Trước
          </UiButton>
          <UiButton variant="secondary" size="sm" :disabled="page >= totalPages" @click="page++">
            Tiếp
          </UiButton>
        </div>
      </div>
    </template>

    <BuildingBulkActionsBar
      v-if="selectionMode && authStore.isAdmin && bulk.selectedIds.value.length > 0"
      :selected-ids="bulk.selectedIds.value"
      :buildings="buildings"
      :run-action="bulk.runAction"
      :is-running="bulk.isRunning.value"
      class="mt-6"
      @clear="bulk.clear"
      @done="onBulkDone"
    />

    <UiModal
      :open="failureModalOpen"
      :title="`Chi tiết ${failuresWithName.length} toà bị bỏ qua`"
      size="lg"
      @close="failureModalOpen = false"
    >
      <ul class="space-y-2 text-sm">
        <li
          v-for="row in failuresWithName"
          :key="row.id"
          class="flex items-start justify-between gap-3 rounded-lg border border-dark-border bg-dark-deep/40 px-3 py-2"
        >
          <span class="font-medium text-white">{{ row.name }}</span>
          <span class="text-xs text-muted">{{ row.reason }}</span>
        </li>
      </ul>
      <template #footer>
        <UiButton variant="secondary" @click="failureModalOpen = false">Đóng</UiButton>
      </template>
    </UiModal>
  </div>
</template>
