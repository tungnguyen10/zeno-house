<script setup lang="ts">
import type { UiTableColumn } from '~/components/ui/UiTable.vue'
import type { ApiSuccess } from '~/types/api'
import type { AccessRequest, AccessRequestStatus, ApprovableRole } from '~/types/access-requests'
import type { Building } from '~/types/buildings'
import type { Tenant } from '~/types/tenants'
import type { TenantAccountListItem } from '~/types/tenant-accounts'
import { getApiErrorMessage } from '~/utils/api-error'

definePageMeta({
  middleware: () => {
    const authStore = useAuthStore()
    if (!authStore.can('users.approve.pending')) return navigateTo('/dashboard')
  },
})

const toast = useToast()
const { selectedStatus, requests, isLoading, error: listError, approve, reject } = useAccessRequests()
const { data: buildingsData } = useFetch<ApiSuccess<Building[]>>('/api/buildings', {
  query: { limit: 100, sort: 'name', order: 'asc' },
})
const { data: tenantsData } = useFetch<ApiSuccess<Tenant[]>>('/api/tenants', {
  query: { limit: 100, sort: 'full_name', order: 'asc' },
})
const { data: tenantAccountsData } = useFetch<ApiSuccess<TenantAccountListItem[]>>('/api/tenant-accounts')
const selectedRequest = ref<AccessRequest | null>(null)

const buildings = computed(() => buildingsData.value?.data ?? [])
const linkedTenantIds = computed(() => new Set((tenantAccountsData.value?.data ?? []).map(account => account.tenantId)))
const tenants = computed(() => (tenantsData.value?.data ?? []).filter(tenant =>
  !linkedTenantIds.value.has(tenant.id) || tenant.id === selectedRequest.value?.decisionTenantId,
))
const columns: UiTableColumn<AccessRequest>[] = [
  { key: 'identity', label: 'Tài khoản' },
  { key: 'provider', label: 'Nguồn', hideOnMobile: true },
  { key: 'createdAt', label: 'Ngày gửi', hideOnMobile: true },
  { key: 'status', label: 'Trạng thái' },
  { key: 'actions', action: true, width: 'w-40' },
]
const statusOptions = [
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'processing', label: 'Cần tiếp tục' },
  { value: 'approved', label: 'Đã duyệt' },
  { value: 'rejected', label: 'Đã từ chối' },
]
const roleOptions = [
  { value: 'owner', label: 'Owner' },
  { value: 'manager', label: 'Manager' },
  { value: 'tenant', label: 'Tenant' },
]

const approvalOpen = ref(false)
const rejectionOpen = ref(false)
const selectedRole = ref<ApprovableRole>('manager')
const selectedBuildingIds = ref<string[]>([])
const selectedTenantId = ref<string | null>(null)
const rejectionReason = ref('')
const formError = ref<string | null>(null)
const busy = ref(false)

function openApproval(request: AccessRequest) {
  selectedRequest.value = request
  selectedRole.value = request.decisionRole ?? 'manager'
  selectedBuildingIds.value = [...request.decisionBuildingIds]
  selectedTenantId.value = request.decisionTenantId
  formError.value = null
  approvalOpen.value = true
}

function openRejection(request: AccessRequest) {
  selectedRequest.value = request
  rejectionReason.value = ''
  formError.value = null
  rejectionOpen.value = true
}

function toggleBuilding(id: string, checked: boolean) {
  selectedBuildingIds.value = checked
    ? [...new Set([...selectedBuildingIds.value, id])]
    : selectedBuildingIds.value.filter(value => value !== id)
}

async function submitApproval() {
  if (!selectedRequest.value) return
  if (selectedRole.value === 'tenant' && !selectedTenantId.value) {
    formError.value = 'Hãy chọn người thuê chưa có tài khoản.'
    return
  }
  if (selectedRole.value !== 'tenant' && selectedBuildingIds.value.length === 0) {
    formError.value = 'Hãy chọn ít nhất một tòa nhà.'
    return
  }
  busy.value = true
  formError.value = null
  try {
    await approve(selectedRequest.value.id, selectedRole.value === 'tenant'
      ? { role: 'tenant', tenant_id: selectedTenantId.value! }
      : { role: selectedRole.value, building_ids: selectedBuildingIds.value })
    approvalOpen.value = false
    toast.success('Đã duyệt và cấp quyền truy cập.')
  }
  catch (error) {
    formError.value = getApiErrorMessage(error, 'Không thể duyệt yêu cầu.')
  }
  finally {
    busy.value = false
  }
}

async function submitRejection() {
  if (!selectedRequest.value) return
  if (rejectionReason.value.trim().length < 3) {
    formError.value = 'Lý do từ chối phải có ít nhất 3 ký tự.'
    return
  }
  busy.value = true
  formError.value = null
  try {
    await reject(selectedRequest.value.id, { reason: rejectionReason.value.trim() })
    rejectionOpen.value = false
    toast.success('Đã từ chối yêu cầu truy cập.')
  }
  catch (error) {
    formError.value = getApiErrorMessage(error, 'Không thể từ chối yêu cầu.')
  }
  finally {
    busy.value = false
  }
}

function statusLabel(status: AccessRequestStatus) {
  return statusOptions.find(option => option.value === status)?.label ?? status
}
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-xs font-medium uppercase tracking-[0.16em] text-cyan">Quyền truy cập</p>
        <h1 class="mt-1 text-2xl font-semibold text-white">Yêu cầu tài khoản</h1>
        <p class="mt-2 max-w-2xl text-sm text-muted">Duyệt danh tính mới và gán đúng vai trò, phạm vi trước khi họ vào hệ thống.</p>
      </div>
      <UiSelect v-model="selectedStatus" class="w-full sm:w-48" label="Trạng thái" :options="statusOptions" />
    </header>

    <UiAlert v-if="listError" severity="danger" title="Không thể tải hàng đợi">
      {{ getApiErrorMessage(listError, 'Hãy tải lại trang và thử lại.') }}
    </UiAlert>

    <UiTable
      :rows="requests"
      :columns="columns"
      :loading="isLoading"
      caption="Danh sách yêu cầu truy cập"
      empty-title="Không có yêu cầu"
      empty-description="Hàng đợi ở trạng thái này đang trống."
    >
      <template #cell-identity="{ row }">
        <div class="min-w-0">
          <p class="truncate font-medium text-white">{{ row.fullName || 'Chưa cung cấp tên' }}</p>
          <p class="max-w-56 truncate text-xs text-muted" :title="row.email">{{ row.email }}</p>
          <p v-if="!row.emailVerified" class="mt-1 text-xs text-warning">Email chưa xác minh</p>
        </div>
      </template>
      <template #cell-provider="{ row }"><span class="capitalize text-muted">{{ row.provider }}</span></template>
      <template #cell-createdAt="{ row }"><span class="text-muted">{{ new Date(row.createdAt).toLocaleDateString('vi-VN') }}</span></template>
      <template #cell-status="{ row }">
        <span class="rounded-full border border-dark-border bg-dark-card px-2 py-1 text-xs text-muted">{{ statusLabel(row.status) }}</span>
      </template>
      <template #cell-actions="{ row }">
        <div v-if="row.status === 'pending' || row.status === 'processing'" class="flex justify-end gap-2">
          <UiButton v-if="row.status === 'pending'" size="sm" variant="ghost" @click="openRejection(row)">Từ chối</UiButton>
          <UiButton size="sm" :disabled="!row.emailVerified" @click="openApproval(row)">{{ row.status === 'processing' ? 'Tiếp tục' : 'Duyệt' }}</UiButton>
        </div>
        <span v-else class="block text-right text-xs text-muted">{{ row.decisionRole || '—' }}</span>
      </template>
    </UiTable>

    <UiModal :open="approvalOpen" title="Duyệt yêu cầu truy cập" size="md" @close="approvalOpen = false">
      <div class="space-y-5">
        <UiAlert severity="info">Role được ghi sau cùng. Nếu Auth gián đoạn, dùng lại đúng quyết định để tiếp tục an toàn.</UiAlert>
        <UiSelect v-model="selectedRole" label="Vai trò" :options="roleOptions" required />
        <div v-if="selectedRole !== 'tenant'" class="space-y-3">
          <p class="text-sm font-medium text-white">Phạm vi tòa nhà</p>
          <div class="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-dark-border bg-dark-surface p-3">
            <UiCheckbox
              v-for="building in buildings"
              :key="building.id"
              :model-value="selectedBuildingIds.includes(building.id)"
              :label="building.name"
              @update:model-value="toggleBuilding(building.id, $event)"
            />
          </div>
        </div>
        <UiSelect
          v-else
          v-model="selectedTenantId"
          label="Người thuê chưa có tài khoản"
          placeholder="Chọn người thuê"
          :options="tenants.map(tenant => ({ value: tenant.id, label: `${tenant.fullName} · ${tenant.code}` }))"
          required
        />
        <UiAlert v-if="formError" severity="danger" role="alert">{{ formError }}</UiAlert>
      </div>
      <template #footer>
        <UiButton variant="ghost" :disabled="busy" @click="approvalOpen = false">Hủy</UiButton>
        <UiButton :loading="busy" @click="submitApproval">Duyệt và cấp quyền</UiButton>
      </template>
    </UiModal>

    <UiModal :open="rejectionOpen" title="Từ chối yêu cầu" size="sm" @close="rejectionOpen = false">
      <div class="space-y-4">
        <UiTextarea v-model="rejectionReason" label="Lý do" placeholder="Nêu lý do để người đăng ký biết cần xử lý gì" :disabled="busy" required />
        <UiAlert v-if="formError" severity="danger" role="alert">{{ formError }}</UiAlert>
      </div>
      <template #footer>
        <UiButton variant="ghost" :disabled="busy" @click="rejectionOpen = false">Hủy</UiButton>
        <UiButton variant="danger" :loading="busy" @click="submitRejection">Xác nhận từ chối</UiButton>
      </template>
    </UiModal>
  </div>
</template>
