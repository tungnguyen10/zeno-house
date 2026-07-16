<script setup lang="ts">

import type { Building } from '~/types/buildings'
import type { ApiSuccess } from '~/types/api'
import type { TenantBulkAction, TenantBulkResult } from '~/composables/tenants/useTenantBulkActions'
import { BULK_FAILURE_LABELS_COMMON } from '~/utils/constants/bulk-failure-labels'
import type { TenantBulkCreateResult, TenantBulkCreateFailure } from '~/composables/tenants/useTenantBulkCreate'

definePageMeta({ title: 'Khách thuê' })

const authStore = useAuthStore()
const toast = useToast()
const {
  tenants,
  total,
  totalPages,
  page,
  q,
  buildingFilter,
  contractStateFilter,
  status,
  sort,
  order,
  hasActiveFilters,
  resetFilters,
  isLoading,
  error,
  refresh,
} = useTenantList()

const { data: buildingsData } = await useFetch<ApiSuccess<Building[]> & { meta: { total: number } }>(
  '/api/buildings',
  { query: { limit: 100 } },
)
const buildingOptions = computed(() =>
  (buildingsData.value?.data ?? []).map(building => ({
    value: building.id,
    label: building.name,
  })),
)

const bulk = useTenantBulkActions()
const bulkCreateOpen = ref(false)
const actionMenuOpen = ref(false)

const selectionMode = ref(false)

function toggleSelectionMode() {
  selectionMode.value = !selectionMode.value
  if (!selectionMode.value) bulk.clear()
  actionMenuOpen.value = false
}

function onToggleSelect(id: string) {
  bulk.toggle(id)
}

const allOnPageSelected = computed(() => {
  if (tenants.value.length === 0) return false
  return tenants.value.every(t => bulk.selectedIds.value.includes(t.id))
})

const someOnPageSelected = computed(() =>
  tenants.value.some(t => bulk.selectedIds.value.includes(t.id)),
)

function toggleAllOnPage(checked: boolean) {
  if (checked) {
    const merged = new Set([...bulk.selectedIds.value, ...tenants.value.map(t => t.id)])
    bulk.selectAll([...merged])
  }
  else {
    const pageIds = new Set(tenants.value.map(t => t.id))
    bulk.selectAll(bulk.selectedIds.value.filter(id => !pageIds.has(id)))
  }
}

const failureModalOpen = ref(false)
const lastFailures = ref<TenantBulkResult['failed']>([])
const lastFailureAction = ref<TenantBulkAction | null>(null)
const bulkCreateFailuresModalOpen = ref(false)
const lastBulkCreateFailures = ref<TenantBulkCreateFailure[]>([])

const reasonLabels: Record<string, string> = {
  ...BULK_FAILURE_LABELS_COMMON,
  has_active_occupancies: 'Đang đồng cư trong hợp đồng',
  forbidden: 'Không có quyền xoá khách thuê này',
}

const bulkCreateReasonLabels: Record<string, string> = {
  validation_error: 'Dữ liệu không hợp lệ',
  duplicate_in_file: 'Trùng lặp trong file',
  duplicate_id_number: 'Số CMND/CCCD đã tồn tại',
  duplicate_phone_in_file: 'Số điện thoại trùng trong file',
  duplicate_phone: 'Số điện thoại đã tồn tại',
  unexpected_error: 'Lỗi không xác định',
}

const failuresWithName = computed(() => {
  const map = new Map(tenants.value.map(t => [t.id, t.fullName]))
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

async function onBulkDone(result: TenantBulkResult, action: TenantBulkAction) {
  const verb = action === 'archive' ? 'lưu trữ' : action === 'activate' ? 'kích hoạt' : 'xoá'
  const succeeded = result.succeeded.length
  const failed = result.failed.length

  lastFailures.value = result.failed
  lastFailureAction.value = action

  if (succeeded > 0 && failed === 0) toast.success(`Đã ${verb} ${succeeded} khách thuê`)
  else if (succeeded > 0 && failed > 0) toast.info(`Đã ${verb} ${succeeded} khách, ${failed} bị bỏ qua`)
  else if (failed > 0) toast.error(`Không thể ${verb}. ${failed} bị bỏ qua`)

  bulk.clear()
  await refreshNuxtData(TENANT_LIST_ASYNC_KEY)
}

async function onBulkCreateDone(result: TenantBulkCreateResult) {
  const created = result.created.length
  const failed = result.failed.length
  lastBulkCreateFailures.value = result.failed
  if (created > 0 && failed === 0) {
    toast.success(`Đã thêm ${created} khách thuê`)
  }
  else if (created > 0 && failed > 0) {
    toast.info(`Đã thêm ${created} khách thuê, ${failed} dòng bị bỏ qua`)
  }
  else {
    toast.error('Không có khách thuê nào được tạo. Vui lòng kiểm tra lại dữ liệu.')
  }
  await refresh()
}

function openBulkCreate() {
  bulkCreateOpen.value = true
  actionMenuOpen.value = false
}

async function openCreateTenant() {
  actionMenuOpen.value = false
  await navigateTo('/dashboard/tenants/create')
}
</script>

<template>
  <div>
    <UiPageHeader title="Khách thuê" :description="`${total} khách thuê`">
      <template #actions>
        <div class="flex items-center gap-2">
          <div
            v-if="authStore.can('tenants.create') || authStore.can('tenants.delete')"
            class="relative"
          >
            <UiButton
              variant="ghost"
              size="sm"
              @click="actionMenuOpen = !actionMenuOpen"
            >
              <span>Hành động</span>
              <IconChevronDown class="h-4 w-4 -mr-1" aria-hidden="true" />
            </UiButton>
            <template v-if="actionMenuOpen">
              <div
                class="fixed inset-0 z-30"
                aria-hidden="true"
                @click="actionMenuOpen = false"
              />
              <div
                class="absolute right-0 z-40 mt-2 w-64 rounded-lg border border-dark-border bg-dark-card py-1 shadow-lg shadow-black/40"
              >
                <UiButton
                  v-if="authStore.can('tenants.create')"
                  variant="ghost"
                  size="sm"
                  class="!flex !w-full !justify-start !rounded-none !px-3 !py-2 text-left !text-white hover:!bg-dark-surface"
                  @click="openCreateTenant"
                >
                  <IconPlus class="h-4 w-4" aria-hidden="true" />
                  <span>Thêm khách thuê</span>
                </UiButton>
                <UiButton
                  v-if="authStore.can('tenants.create')"
                  variant="ghost"
                  size="sm"
                  class="!flex !w-full !justify-start !rounded-none !px-3 !py-2 text-left !text-white hover:!bg-dark-surface"
                  @click="openBulkCreate"
                >
                  <IconUsers class="h-4 w-4" aria-hidden="true" />
                  <span>Thêm nhanh nhiều khách thuê</span>
                </UiButton>
                <UiButton
                  v-if="authStore.can('tenants.delete')"
                  variant="ghost"
                  size="sm"
                  class="!flex !w-full !justify-start !rounded-none !px-3 !py-2 text-left !text-white hover:!bg-dark-surface"
                  @click="toggleSelectionMode"
                >
                  <IconCheckCircle class="h-4 w-4" aria-hidden="true" />
                  <span>{{ selectionMode ? 'Thoát chọn nhiều' : 'Chọn nhiều khách thuê' }}</span>
                </UiButton>
              </div>
            </template>
          </div>
        </div>
      </template>
    </UiPageHeader>

    <TenantListToolbar
      v-model:q="q"
      v-model:building-filter="buildingFilter"
      v-model:contract-state-filter="contractStateFilter"
      v-model:status="status"
      v-model:sort="sort"
      v-model:order="order"
      :building-options="buildingOptions"
      :has-active-filters="hasActiveFilters"
      class="mb-4"
      @reset="resetFilters"
    />

    <UiAlert v-if="lastFailures.length > 0" severity="warning" class="mb-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <span class="text-sm">
          {{ lastFailures.length }} khách bị bỏ qua trong lần {{ lastActionVerb }} gần nhất.
        </span>
        <div class="flex items-center gap-2">
          <UiButton size="sm" variant="secondary" @click="failureModalOpen = true">Xem chi tiết</UiButton>
          <UiButton size="sm" variant="ghost" @click="lastFailures = []">Đóng</UiButton>
        </div>
      </div>
    </UiAlert>

    <UiAlert v-if="lastBulkCreateFailures.length > 0" severity="warning" class="mb-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <span class="text-sm">
          {{ lastBulkCreateFailures.length }} dòng bị bỏ qua trong lần nhập gần nhất.
        </span>
        <div class="flex items-center gap-2">
          <UiButton size="sm" variant="secondary" @click="bulkCreateFailuresModalOpen = true">Xem chi tiết</UiButton>
          <UiButton size="sm" variant="ghost" @click="lastBulkCreateFailures = []">Đóng</UiButton>
        </div>
      </div>
    </UiAlert>

    <div v-if="isLoading" class="space-y-3">
      <UiSkeleton v-for="n in 5" :key="n" class="h-16 rounded-xl" />
    </div>

    <UiAlert v-else-if="error" severity="danger">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <span>Không thể tải danh sách khách thuê.</span>
        <UiButton variant="secondary" size="sm" @click="refresh()">Thử lại</UiButton>
      </div>
    </UiAlert>

    <UiEmptyState
      v-else-if="tenants.length === 0 && hasActiveFilters"
      variant="search"
      title="Không tìm thấy khách thuê phù hợp"
      description="Thử bỏ bớt bộ lọc hoặc thay đổi từ khoá tìm kiếm."
    >
      <template #action>
        <UiButton variant="secondary" @click="resetFilters">Xoá bộ lọc</UiButton>
      </template>
    </UiEmptyState>

    <UiEmptyState
      v-else-if="tenants.length === 0"
      title="Chưa có khách thuê nào"
      description="Bắt đầu bằng cách thêm khách thuê đầu tiên."
    >
      <template v-if="authStore.can('tenants.create')" #action>
        <NuxtLink to="/dashboard/tenants/create">
          <UiButton>Thêm khách thuê đầu tiên</UiButton>
        </NuxtLink>
      </template>
    </UiEmptyState>

    <template v-else>
      <div
        v-if="selectionMode && authStore.can('tenants.delete')"
        class="mb-3 flex items-center justify-between gap-3 rounded-lg border border-dark-border bg-dark-deep/40 px-3 py-2"
      >
        <UiCheckbox
          :model-value="allOnPageSelected"
          :indeterminate="someOnPageSelected && !allOnPageSelected"
          :label="`Chọn cả trang (${tenants.length})`"
          @update:model-value="toggleAllOnPage"
        />
        <span class="text-xs text-muted">{{ bulk.selectedIds.value.length }} đã chọn tổng cộng</span>
      </div>

      <div class="space-y-2">
        <div
          v-for="tenant in tenants"
          :key="tenant.id"
          class="flex items-stretch gap-2"
        >
          <label
            v-if="selectionMode && authStore.can('tenants.delete')"
            class="flex items-center pl-1"
          >
            <UiCheckbox
              :model-value="bulk.selectedIds.value.includes(tenant.id)"
              :aria-label="`Chọn ${tenant.fullName}`"
              @update:model-value="onToggleSelect(tenant.id)"
            />
          </label>
          <UiListRow
            :to="`/dashboard/tenants/${tenant.code}`"
            class="flex-1"
          >
            <div class="flex items-start gap-3">
              <div
                class="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan/10 text-cyan text-xs font-semibold"
                aria-hidden="true"
              >
                {{ tenant.fullName.charAt(0).toUpperCase() }}
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <p class="text-sm font-medium text-white truncate">{{ tenant.fullName }}</p>
                  <UiBadge :variant="tenant.hasActiveContract ? 'success' : 'neutral'" pill>
                    {{ tenant.hasActiveContract ? 'Có HĐ' : 'Chưa có HĐ' }}
                  </UiBadge>
                  <UiBadge
                    v-if="tenant.activeAssignment?.assignmentRole === 'roommate'"
                    variant="accent"
                    pill
                  >
                    Ở chung
                  </UiBadge>
                  <UiBadge v-if="tenant.status === 'archived'" variant="warning" pill>
                    Đã lưu trữ
                  </UiBadge>
                </div>
                <p class="text-xs text-muted mt-0.5 truncate">
                  {{ tenant.phone }}<template v-if="tenant.idNumber"> · CMND/CCCD: {{ tenant.idNumber }}</template>
                </p>
                <p
                  v-if="tenant.activeAssignment?.assignmentRole === 'roommate' && tenant.activeAssignment.primaryTenantName"
                  class="text-xs text-muted mt-0.5 truncate"
                >
                  Ở chung với {{ tenant.activeAssignment.primaryTenantName }}
                </p>
                <p v-if="tenant.activeAssignment" class="text-xs text-muted mt-0.5 truncate">
                  Phòng {{ tenant.activeAssignment.roomNumber }} · {{ tenant.activeAssignment.buildingName }}
                </p>
              </div>
            </div>
          </UiListRow>
        </div>
      </div>

      <div v-if="totalPages > 1" class="flex items-center justify-between mt-6 pt-4 border-t border-dark-border">
        <p class="text-sm text-muted">Trang {{ page }} / {{ totalPages }}</p>
        <div class="flex gap-2">
          <UiButton variant="secondary" size="sm" :disabled="page <= 1" @click="page--">← Trước</UiButton>
          <UiButton variant="secondary" size="sm" :disabled="page >= totalPages" @click="page++">Tiếp →</UiButton>
        </div>
      </div>
    </template>

    <TenantBulkActionsBar
      v-if="selectionMode && authStore.can('tenants.delete') && bulk.selectedIds.value.length > 0"
      :selected-ids="bulk.selectedIds.value"
      :tenants="tenants"
      :run-action="bulk.runAction"
      :is-running="bulk.isRunning.value"
      class="mt-6"
      @clear="bulk.clear"
      @done="onBulkDone"
    />

    <UiModal
      :open="failureModalOpen"
      :title="`Chi tiết ${failuresWithName.length} khách bị bỏ qua`"
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

    <UiModal
      :open="bulkCreateFailuresModalOpen"
      :title="`Chi tiết ${lastBulkCreateFailures.length} dòng bị bỏ qua`"
      size="lg"
      @close="bulkCreateFailuresModalOpen = false"
    >
      <ul class="space-y-2 text-sm">
        <li
          v-for="row in lastBulkCreateFailures"
          :key="row.line"
          class="flex flex-col gap-1 rounded-lg border border-dark-border bg-dark-deep/40 px-3 py-2"
        >
          <div class="flex items-start justify-between gap-3">
            <span class="font-medium text-white">Dòng {{ row.line }}</span>
            <span class="text-xs text-rose-300 font-medium">{{ bulkCreateReasonLabels[row.reason] ?? row.reason }}</span>
          </div>
          <p class="text-xs text-muted">{{ row.message }}</p>
          <ul v-if="row.fieldErrors && Object.keys(row.fieldErrors).length > 0" class="text-xs text-rose-200 ml-2 mt-1">
            <li v-for="(errors, field) in row.fieldErrors" :key="field">
              <strong>{{ field }}:</strong> {{ (errors as string[]).join(', ') }}
            </li>
          </ul>
        </li>
      </ul>
      <template #footer>
        <UiButton variant="secondary" @click="bulkCreateFailuresModalOpen = false">Đóng</UiButton>
      </template>
    </UiModal>

    <TenantBulkCreateModal
      :open="bulkCreateOpen"
      @close="bulkCreateOpen = false"
      @done="onBulkCreateDone"
    />
  </div>
</template>
