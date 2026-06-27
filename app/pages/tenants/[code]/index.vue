<script setup lang="ts">
import type { ContractWithDetails } from '~/types/contracts'
import type { ApiSuccess } from '~/types/api'
import type { Tenant } from '~/types/tenants'
import { formatCurrency } from '~/utils/format/currency'
import { contractPath, tenantPath } from '~/utils/routes/operational'
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

// Contracts
const { data: contractsData } = await useFetch<ApiSuccess<ContractWithDetails[]> & { meta: { total: number } }>(
  '/api/contracts',
  { query: { tenant_id: id, limit: 50 } },
)
const tenantContracts = computed(() => contractsData.value?.data ?? [])
const activeContract = computed(() => tenantContracts.value.find(c => c.status === 'active') ?? null)
const activeContractCount = computed(() => tenantContracts.value.filter(c => c.status === 'active').length)
const occupancyCount = computed(() =>
  tenantContracts.value.reduce((sum, c) => sum + (c.occupantCount ?? 0), 0),
)
const currentRoomLabel = computed(() => {
  if (!activeContract.value) return null
  const { room } = activeContract.value
  return `Phòng ${room.roomNumber} — ${room.buildingName}`
})

const showDeleteModal = ref(false)
const isDeleting = ref(false)

interface ConflictDetails {
  activeContracts?: number
  activeOccupancies?: number
}

const conflictDetails = ref<ConflictDetails | null>(null)

async function confirmDelete() {
  isDeleting.value = true
  conflictDetails.value = null
  try {
    await $fetch(`/api/tenants/${id}`, { method: 'DELETE' })
    showDeleteModal.value = false
    await navigateTo('/tenants')
  }
  catch (e: unknown) {
    const err = e as {
      statusCode?: number
      data?: { error?: { code?: string; details?: ConflictDetails } }
    }
    if (err?.statusCode === 409 || err?.data?.error?.code === 'CONFLICT') {
      conflictDetails.value = err.data?.error?.details ?? {}
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
  isDeleting.value = true
  try {
    await $fetch(`/api/tenants/${id}`, {
      method: 'DELETE',
      query: { force: true },
    })
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
  if (error.value?.statusCode === 404) navigateTo('/tenants')
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
      <UiPageHeader :title="tenant.fullName" :description="tenant.phone">
        <template #actions>
          <div v-if="authStore.isAdmin" class="flex gap-2 shrink-0">
            <NuxtLink :to="`/tenants/${tenant.code}/edit`">
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
            <p class="text-sm font-medium text-white">Không thể xoá khách thuê này</p>
            <p class="mt-1 text-xs text-muted">
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

      <section id="personal" class="mt-6 rounded-xl border border-dark-border bg-dark-surface p-6">
        <h3 class="mb-4 text-sm font-semibold text-white">Thông tin cá nhân</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p class="text-xs text-muted mb-1">Số điện thoại</p>
            <p class="text-sm text-white">{{ tenant.phone }}</p>
          </div>
          <div v-if="tenant.email">
            <p class="text-xs text-muted mb-1">Email</p>
            <p class="text-sm text-white">{{ tenant.email }}</p>
          </div>
          <div v-if="tenant.gender">
            <p class="text-xs text-muted mb-1">Giới tính</p>
            <p class="text-sm text-white">
              {{ tenant.gender === 'male' ? 'Nam' : tenant.gender === 'female' ? 'Nữ' : 'Khác' }}
            </p>
          </div>
          <div v-if="tenant.occupation">
            <p class="text-xs text-muted mb-1">Nghề nghiệp</p>
            <p class="text-sm text-white">{{ tenant.occupation }}</p>
          </div>
          <div v-if="tenant.dateOfBirth">
            <p class="text-xs text-muted mb-1">Ngày sinh</p>
            <p class="text-sm text-white">{{ new Date(tenant.dateOfBirth).toLocaleDateString('vi-VN') }}</p>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">Ngày tạo</p>
            <p class="text-sm text-white">{{ new Date(tenant.createdAt).toLocaleDateString('vi-VN') }}</p>
          </div>
        </div>
        <div v-if="tenant.permanentAddress" class="mt-4">
          <p class="text-xs text-muted mb-1">Địa chỉ thường trú</p>
          <p class="text-sm text-white">{{ tenant.permanentAddress }}</p>
        </div>
        <div v-if="tenant.notes" class="mt-4 pt-4 border-t border-dark-border">
          <p class="text-xs text-muted mb-1">Ghi chú</p>
          <p class="text-sm text-white whitespace-pre-wrap">{{ tenant.notes }}</p>
        </div>
      </section>

      <section
        v-if="tenant.idNumber || tenant.idIssuedDate || tenant.idIssuedPlace"
        id="id-document"
        class="mt-4 rounded-xl border border-dark-border bg-dark-surface p-6"
      >
        <h3 class="mb-4 text-sm font-semibold text-white">Giấy tờ tuỳ thân</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div v-if="tenant.idNumber">
            <p class="text-xs text-muted mb-1">Số CMND/CCCD</p>
            <p class="text-sm text-white">{{ tenant.idNumber }}</p>
          </div>
          <div v-if="tenant.idIssuedDate">
            <p class="text-xs text-muted mb-1">Ngày cấp</p>
            <p class="text-sm text-white">{{ new Date(tenant.idIssuedDate).toLocaleDateString('vi-VN') }}</p>
          </div>
          <div v-if="tenant.idIssuedPlace">
            <p class="text-xs text-muted mb-1">Nơi cấp</p>
            <p class="text-sm text-white">{{ tenant.idIssuedPlace }}</p>
          </div>
        </div>
      </section>

      <section
        v-if="tenant.emergencyContactName || tenant.emergencyContactPhone"
        id="emergency"
        class="mt-4 rounded-xl border border-dark-border bg-dark-surface p-6"
      >
        <h3 class="mb-4 text-sm font-semibold text-white">Liên hệ khẩn cấp</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div v-if="tenant.emergencyContactName">
            <p class="text-xs text-muted mb-1">Tên</p>
            <p class="text-sm text-white">{{ tenant.emergencyContactName }}</p>
          </div>
          <div v-if="tenant.emergencyContactPhone">
            <p class="text-xs text-muted mb-1">Số điện thoại</p>
            <p class="text-sm text-white">{{ tenant.emergencyContactPhone }}</p>
          </div>
        </div>
      </section>

      <section id="contracts" class="mt-4 rounded-xl border border-dark-border bg-dark-surface p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-semibold text-white">Hợp đồng</h3>
          <NuxtLink v-if="authStore.isAdmin" to="/contracts/create" class="text-xs text-cyan hover:underline">
            + Thêm
          </NuxtLink>
        </div>
        <div v-if="tenantContracts.length > 0" class="space-y-2">
          <UiListRow
            v-for="contract in tenantContracts"
            :key="contract.id"
            :to="contractPath(contract)"
            compact
          >
            <div class="flex items-center gap-2 flex-wrap">
              <p class="text-xs font-medium text-white truncate">
                Phòng {{ contract.room.roomNumber }} — {{ contract.room.buildingName }}
              </p>
              <UiStatusBadge :status="contract.status" />
            </div>
            <p class="text-xs text-muted mt-0.5 truncate">
              {{ new Date(contract.startDate).toLocaleDateString('vi-VN') }} —
              {{ new Date(contract.endDate).toLocaleDateString('vi-VN') }}
              · {{ formatCurrency(contract.monthlyRent) }}/tháng
            </p>
          </UiListRow>
        </div>
        <p v-else class="text-sm text-muted">Chưa có hợp đồng</p>
      </section>

      <section
        v-if="authStore.isAdmin"
        id="danger-zone"
        class="mt-4 rounded-xl border border-error/30 bg-error/5 p-6"
      >
        <h3 class="mb-2 text-sm font-semibold text-error">Vùng nguy hiểm</h3>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-xs text-muted">
            Xoá khách thuê chỉ thực hiện được khi không còn hợp đồng đang hoạt động và không còn đồng cư trong hợp đồng nào.
          </p>
          <div class="flex items-center gap-2">
            <UiButton variant="secondary" size="sm" :loading="isDeleting" @click="archiveInstead">
              Lưu trữ
            </UiButton>
            <UiButton variant="danger" size="sm" @click="showDeleteModal = true">
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
    />
  </div>
</template>
