<script setup lang="ts">

import type { ContractWithDetails } from '~/types/contracts'
import type { ApiSuccess } from '~/types/api'
import type { Tenant } from '~/types/tenants'
import { formatCurrency } from '~/utils/format/currency'
import { contractPath, tenantPath } from '~/utils/routes/operational'
import { getApiErrorCode, getApiErrorDetails, type ApiErrorLike } from '~/utils/api-error'
import { isUuid } from '~/utils/format/slug'

definePageMeta({ title: 'Chi tiết khách thuê' })

const route = useRoute()
const authStore = useAuthStore()
const toast = useToast()
const id = route.params.code as string

// Redirect UUID-based URLs to code-based canonical URL
if (isUuid(id)) {
  const { data: redirectData } = await useFetch<ApiSuccess<Tenant>>(`/api/tenants/${id}`)
  if (redirectData.value?.data) {
    await navigateTo(tenantPath(redirectData.value.data), { replace: true })
  }
}

const { tenant, isLoading, error, refresh } = useTenantDetail(id)

// Mobile large-title collapse: fades into the persistent app header once scrolled past.
const titleSentinel = ref<HTMLElement | null>(null)
const isTitleCollapsed = ref(false)
useIntersectionObserver(titleSentinel, ([entry]) => {
  isTitleCollapsed.value = !!entry && !entry.isIntersecting
})
const headerTitle = useAppHeaderTitle()
const compactTitle = computed(() => (isTitleCollapsed.value && tenant.value ? tenant.value.fullName : null))
watchEffect(() => {
  headerTitle.value = compactTitle.value
})
onBeforeUnmount(() => {
  // A newer page can claim this slot before this instance unmounts during a
  // page transition — only clear it if it's still ours.
  if (headerTitle.value === compactTitle.value) headerTitle.value = null
})

// Contracts
const { data: contractsData } = useLazyFetch<ApiSuccess<ContractWithDetails[]> & { meta: { total: number } }>(
  '/api/contracts',
  { query: { tenant_id: id, limit: 50 } },
)
const tenantContracts = computed(() => contractsData.value?.data ?? [])
const activeContract = computed(() => tenantContracts.value.find(c => c.status === 'active') ?? null)
const activeContractCount = computed(() => {
  const count = tenantContracts.value.filter(c => c.status === 'active').length
  if (count > 0) return count
  return tenant.value?.hasActiveContract ? 1 : 0
})
const occupancyCount = computed(() =>
  tenantContracts.value.reduce((sum, c) => sum + (c.occupantCount ?? 0), 0),
)
const isRoommate = computed(() => tenant.value?.activeAssignment?.assignmentRole === 'roommate')
const roommateContractPath = computed(() =>
  tenant.value?.activeAssignment ? `/dashboard/contracts/${tenant.value.activeAssignment.contractId}` : null,
)
const currentRoomLabel = computed(() => {
  if (tenant.value?.activeAssignment) {
    const assignment = tenant.value.activeAssignment
    return `Phòng ${assignment.roomNumber} — ${assignment.buildingName}`
  }
  if (!activeContract.value) return null
  const { room } = activeContract.value
  return `Phòng ${room.roomNumber} — ${room.buildingName}`
})

const showDeleteModal = ref(false)
const showArchiveModal = ref(false)
const isDeleting = ref(false)
const deleteReason = ref('')
const deleteReasonError = ref('')
const archiveReason = ref('')
const archiveReasonError = ref('')

interface ConflictDetails {
  activeContracts?: number
  activeOccupancies?: number
}

const conflictDetails = ref<ConflictDetails | null>(null)

function openDeleteModal() {
  deleteReason.value = ''
  deleteReasonError.value = ''
  showDeleteModal.value = true
}

function openArchiveModal() {
  archiveReason.value = ''
  archiveReasonError.value = ''
  showArchiveModal.value = true
}

async function confirmDelete() {
  const reason = deleteReason.value.trim()
  if (!reason) {
    deleteReasonError.value = 'Lý do xoá là bắt buộc.'
    return
  }

  deleteReasonError.value = ''
  isDeleting.value = true
  conflictDetails.value = null
  try {
    await apiFetch(`/api/tenants/${id}`, {
      method: 'DELETE',
      body: { reason },
    })
    invalidateTenantListCache()
    showDeleteModal.value = false
    await navigateTo('/dashboard/tenants')
  }
  catch (e: unknown) {
    const err = e as ApiErrorLike
    if (err.statusCode === 409 || getApiErrorCode(err) === 'CONFLICT') {
      conflictDetails.value = getApiErrorDetails<ConflictDetails>(err) ?? {}
      showDeleteModal.value = false
    }
    else {
      toast.error('Không thể xoá khách thuê. Vui lòng thử lại.')
    }
  }
  finally {
    isDeleting.value = false
  }
}

async function archiveInstead() {
  if (!tenant.value) return
  const reason = deleteReason.value.trim()
  if (!reason) {
    toast.error('Thiếu lý do xoá. Vui lòng thử lại thao tác xoá.')
    return
  }

  isDeleting.value = true
  try {
    await apiFetch(`/api/tenants/${id}`, {
      method: 'DELETE',
      query: { force: true },
      body: { reason },
    })
    invalidateTenantListCache()
    toast.success(`Đã lưu trữ khách thuê ${tenant.value.fullName}`)
    conflictDetails.value = null
    await refresh()
  }
  catch {
    toast.error('Không thể lưu trữ khách thuê.')
  }
  finally {
    isDeleting.value = false
  }
}

async function confirmArchive() {
  if (!tenant.value) return

  const reason = archiveReason.value.trim()
  if (!reason) {
    archiveReasonError.value = 'Lý do lưu trữ là bắt buộc.'
    return
  }

  archiveReasonError.value = ''
  isDeleting.value = true
  try {
    await apiFetch(`/api/tenants/${id}`, {
      method: 'DELETE',
      query: { force: true },
      body: { reason },
    })
    invalidateTenantListCache()
    showArchiveModal.value = false
    toast.success(`Đã lưu trữ khách thuê ${tenant.value.fullName}`)
    conflictDetails.value = null
    await refresh()
  }
  catch {
    toast.error('Không thể lưu trữ khách thuê.')
  }
  finally {
    isDeleting.value = false
  }
}

watchEffect(() => {
  if (error.value?.statusCode === 404) navigateTo('/dashboard/tenants')
})
</script>

<template>
  <div>
    <div v-if="isLoading" class="space-y-4">
      <UiSkeleton class="h-8 w-64 rounded-lg" />
      <UiSkeleton class="h-48 rounded-xl" />
    </div>

    <UiAlert v-else-if="error && error.statusCode !== 404" severity="danger">
      Không thể tải thông tin khách thuê.
    </UiAlert>

    <template v-else-if="tenant">
      <UiPageHeader
        :title="tenant.fullName"
        :description="tenant.phone"
        :back-to="'/dashboard/tenants'"
        back-label="Khách thuê"
      >
        <div ref="titleSentinel" aria-hidden="true" />
        <template #actions>
          <div v-if="authStore.can('tenants.update')" class="flex gap-2 shrink-0">
            <NuxtLink :to="`/dashboard/tenants/${tenant.code}/edit`">
              <UiButton variant="secondary" size="sm">Chỉnh sửa</UiButton>
            </NuxtLink>
          </div>
        </template>
      </UiPageHeader>

      <UiAlert
        v-if="conflictDetails"
        severity="warning"
        class="mt-6"
        data-test="delete-conflict-alert"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-sm font-medium text-ui-primary">Không thể xoá khách thuê này</p>
            <p class="mt-1 text-xs text-ui-muted">
              <template v-if="conflictDetails.activeContracts">
                Còn {{ conflictDetails.activeContracts }} hợp đồng đang hoạt động.
              </template>
              <template v-if="conflictDetails.activeOccupancies">
                Còn đồng cư trong {{ conflictDetails.activeOccupancies }} hợp đồng.
              </template>
              Bạn có thể lưu trữ khách thay vì xoá vĩnh viễn.
            </p>
          </div>
          <div class="flex items-center gap-2">
            <UiButton variant="secondary" size="sm" :loading="isDeleting" @click="archiveInstead">
              Lưu trữ thay vì xoá
            </UiButton>
            <UiButton variant="ghost" size="sm" @click="conflictDetails = null">Đóng</UiButton>
          </div>
        </div>
      </UiAlert>

      <div class="mt-6">
        <TenantDetailHero
          :tenant="tenant"
          :active-contract-count="activeContractCount"
          :current-room-label="currentRoomLabel"
          :occupancy-count="occupancyCount"
        />
      </div>

      <UiAlert
        v-if="isRoommate && tenant.activeAssignment"
        severity="info"
        class="mt-4"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-sm font-medium text-ui-primary">Khách thuê đang ở chung</p>
            <p class="mt-1 text-xs text-ui-muted">
              <template v-if="tenant.activeAssignment.primaryTenantName">
                Đang ở chung với {{ tenant.activeAssignment.primaryTenantName }} tại
              </template>
              Phòng {{ tenant.activeAssignment.roomNumber }} — {{ tenant.activeAssignment.buildingName }}.
              Cần xoá trạng thái ở chung trước khi thêm hợp đồng mới.
            </p>
          </div>
          <NuxtLink
            v-if="roommateContractPath"
            :to="roommateContractPath"
            class="text-xs text-ui-accent hover:underline"
          >
            Mở hợp đồng hiện tại
          </NuxtLink>
        </div>
      </UiAlert>

      <UiSurfacePanel id="personal" as="section" class="mt-6">
        <h3 class="mb-2 text-sm font-semibold text-ui-primary">Thông tin cá nhân</h3>
        <UiDefinitionList>
          <UiDefinitionItem label="Số điện thoại" :value="tenant.phone" />
          <UiDefinitionItem v-if="tenant.email" label="Email" :value="tenant.email" />
          <UiDefinitionItem
            v-if="tenant.gender"
            label="Giới tính"
            :value="tenant.gender === 'male' ? 'Nam' : tenant.gender === 'female' ? 'Nữ' : 'Khác'"
          />
          <UiDefinitionItem v-if="tenant.occupation" label="Nghề nghiệp" :value="tenant.occupation" />
          <UiDefinitionItem
            v-if="tenant.dateOfBirth"
            label="Ngày sinh"
            :value="new Date(tenant.dateOfBirth).toLocaleDateString('vi-VN')"
          />
          <UiDefinitionItem label="Ngày tạo" :value="new Date(tenant.createdAt).toLocaleDateString('vi-VN')" />
          <UiDefinitionItem
            v-if="tenant.permanentAddress"
            label="Địa chỉ thường trú"
            :value="tenant.permanentAddress"
            stacked
          />
          <UiDefinitionItem v-if="tenant.notes" label="Ghi chú" stacked>
            <span class="whitespace-pre-wrap">{{ tenant.notes }}</span>
          </UiDefinitionItem>
        </UiDefinitionList>
      </UiSurfacePanel>

      <UiSurfacePanel
        v-if="tenant.idNumber || tenant.idIssuedDate || tenant.idIssuedPlace || tenant.idCardFrontSignedUrl || tenant.idCardBackSignedUrl"
        id="id-document"
        as="section"
        class="mt-4"
      >
        <h3 class="mb-2 text-sm font-semibold text-ui-primary">Giấy tờ tuỳ thân</h3>
        <UiDefinitionList>
          <UiDefinitionItem v-if="tenant.idNumber" label="Số CMND/CCCD" :value="tenant.idNumber" />
          <UiDefinitionItem
            v-if="tenant.idIssuedDate"
            label="Ngày cấp"
            :value="new Date(tenant.idIssuedDate).toLocaleDateString('vi-VN')"
          />
          <UiDefinitionItem v-if="tenant.idIssuedPlace" label="Nơi cấp" :value="tenant.idIssuedPlace" />
        </UiDefinitionList>

        <div v-if="tenant.idCardFrontSignedUrl || tenant.idCardBackSignedUrl" class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div v-if="tenant.idCardFrontSignedUrl" class="space-y-1.5">
            <p class="text-xs text-ui-muted">Mặt trước</p>
            <a
              :href="tenant.idCardFrontSignedUrl"
              target="_blank"
              rel="noopener"
              class="group relative block overflow-hidden rounded-lg border border-ui-border bg-ui-deep/30 transition-colors hover:border-ui-accent/50"
            >
              <img
                :src="tenant.idCardFrontSignedUrl"
                alt="CCCD mặt trước"
                class="w-full object-cover"
              >
              <span class="absolute inset-0 flex items-center justify-center rounded-lg bg-ui-overlay/0 opacity-0 transition-all group-hover:bg-ui-overlay/30 group-hover:opacity-100">
                <IconArrowUpRight class="h-5 w-5 text-ui-primary drop-shadow" aria-hidden="true" />
              </span>
            </a>
          </div>

          <div v-if="tenant.idCardBackSignedUrl" class="space-y-1.5">
            <p class="text-xs text-ui-muted">Mặt sau</p>
            <a
              :href="tenant.idCardBackSignedUrl"
              target="_blank"
              rel="noopener"
              class="group relative block overflow-hidden rounded-lg border border-ui-border bg-ui-deep/30 transition-colors hover:border-ui-accent/50"
            >
              <img
                :src="tenant.idCardBackSignedUrl"
                alt="CCCD mặt sau"
                class="w-full object-cover"
              >
              <span class="absolute inset-0 flex items-center justify-center rounded-lg bg-ui-overlay/0 opacity-0 transition-all group-hover:bg-ui-overlay/30 group-hover:opacity-100">
                <IconArrowUpRight class="h-5 w-5 text-ui-primary drop-shadow" aria-hidden="true" />
              </span>
            </a>
          </div>
        </div>

        <p
          v-if="authStore.can('tenants.update')"
          class="mt-3 text-xs text-ui-muted"
        >
          Bạn có thể cập nhật ảnh CCCD ở trang chỉnh sửa khách thuê.
        </p>
      </UiSurfacePanel>

      <UiSurfacePanel
        v-if="tenant.emergencyContactName || tenant.emergencyContactPhone"
        id="emergency"
        as="section"
        class="mt-4"
      >
        <h3 class="mb-2 text-sm font-semibold text-ui-primary">Liên hệ khẩn cấp</h3>
        <UiDefinitionList>
          <UiDefinitionItem v-if="tenant.emergencyContactName" label="Tên" :value="tenant.emergencyContactName" />
          <UiDefinitionItem v-if="tenant.emergencyContactPhone" label="Số điện thoại" :value="tenant.emergencyContactPhone" />
        </UiDefinitionList>
      </UiSurfacePanel>

      <UiSurfacePanel id="contracts" as="section" class="mt-4">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-semibold text-ui-primary">Hợp đồng</h3>
          <NuxtLink
            v-if="authStore.can('contracts.create') && !isRoommate"
            to="/dashboard/contracts/create"
            class="text-xs text-ui-accent hover:underline"
          >
            + Thêm
          </NuxtLink>
          <span
            v-else-if="authStore.can('contracts.create') && isRoommate"
            class="text-xs text-ui-muted"
          >
            Không thể thêm HĐ khi đang ở chung
          </span>
        </div>
        <div v-if="tenantContracts.length > 0" class="space-y-2">
          <UiListRow
            v-for="contract in tenantContracts"
            :key="contract.id"
            :to="contractPath(contract)"
            compact
          >
            <div class="flex items-center gap-2 flex-wrap">
              <p class="text-xs font-medium text-ui-primary truncate">
                Phòng {{ contract.room.roomNumber }} — {{ contract.room.buildingName }}
              </p>
              <UiStatusBadge :status="contract.status" />
            </div>
            <p class="text-xs text-ui-muted mt-0.5 truncate">
              {{ new Date(contract.startDate).toLocaleDateString('vi-VN') }} —
              {{ new Date(contract.endDate).toLocaleDateString('vi-VN') }}
              · {{ formatCurrency(contract.monthlyRent) }}/tháng
            </p>
          </UiListRow>
        </div>
        <p v-else class="text-sm text-ui-muted">Chưa có hợp đồng</p>
      </UiSurfacePanel>

      <section
        v-if="authStore.can('tenants.delete')"
        id="danger-zone"
        class="mt-4 rounded-xl border border-status-danger/30 bg-status-danger/5 p-6"
      >
        <h3 class="mb-2 text-sm font-semibold text-status-danger">Vùng nguy hiểm</h3>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-xs text-ui-muted">
            Xoá khách thuê chỉ thực hiện được khi không còn hợp đồng đang hoạt động và không còn đồng cư trong hợp đồng nào.
          </p>
          <div class="flex items-center gap-2">
            <UiButton variant="secondary" size="sm" :loading="isDeleting" @click="openArchiveModal">
              Lưu trữ
            </UiButton>
            <UiButton variant="danger" size="sm" @click="openDeleteModal">
              Xoá khách thuê
            </UiButton>
          </div>
        </div>
      </section>
    </template>

    <UiConfirmModal
      :open="showDeleteModal"
      title="Xác nhận xoá"
      :message="`Bạn có chắc muốn xoá khách thuê ${tenant?.fullName ?? ''}? Hành động này không thể hoàn tác.`"
      :loading="isDeleting"
      @confirm="confirmDelete"
      @cancel="showDeleteModal = false"
    >
      <div class="space-y-3">
        <p class="text-sm text-ui-muted">
          Bạn có chắc muốn xoá khách thuê {{ tenant?.fullName ?? '' }}? Hành động này không thể hoàn tác.
        </p>
        <UiTextarea
          v-model="deleteReason"
          label="Lý do xoá"
          :rows="3"
          placeholder="Ví dụ: tạo trùng hồ sơ do thao tác nhầm"
          :error="deleteReasonError"
          @update:model-value="deleteReasonError = ''"
        />
      </div>
    </UiConfirmModal>

    <UiConfirmModal
      :open="showArchiveModal"
      title="Xác nhận lưu trữ"
      :message="`Bạn có chắc muốn lưu trữ khách thuê ${tenant?.fullName ?? ''}?`"
      confirm-label="Lưu trữ"
      :loading="isDeleting"
      @confirm="confirmArchive"
      @cancel="showArchiveModal = false"
    >
      <div class="space-y-3">
        <p class="text-sm text-ui-muted">
          Bạn có chắc muốn lưu trữ khách thuê {{ tenant?.fullName ?? '' }}?
        </p>
        <UiTextarea
          v-model="archiveReason"
          label="Lý do lưu trữ"
          :rows="3"
          placeholder="Ví dụ: khách đã rời đi, cần lưu hồ sơ"
          :error="archiveReasonError"
          @update:model-value="archiveReasonError = ''"
        />
      </div>
    </UiConfirmModal>
  </div>
</template>
