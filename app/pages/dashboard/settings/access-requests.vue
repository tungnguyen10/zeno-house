<script setup lang="ts">
import type { UiTabItem } from '~/components/ui/UiTabs.vue'
import type { ApiSuccess } from '~/types/api'
import type { AccessRequest, AccessRequestStatus, ApprovableRole } from '~/types/access-requests'
import type { Building } from '~/types/buildings'
import type { Tenant } from '~/types/tenants'
import type { TenantAccountListItem } from '~/types/tenant-accounts'
import { getApiErrorMessage } from '~/utils/api-error'
import { userInitials } from '~/utils/users/display'

definePageMeta({
  middleware: () => {
    const authStore = useAuthStore()
    if (!authStore.can('users.approve.pending')) return navigateTo('/dashboard')
  },
})

// Mobile large-title collapse: fades into the persistent app header once scrolled past.
const titleSentinel = ref<HTMLElement | null>(null)
const isTitleCollapsed = ref(false)
useIntersectionObserver(titleSentinel, ([entry]) => {
  isTitleCollapsed.value = !!entry && !entry.isIntersecting
})
const headerTitle = useAppHeaderTitle()
const compactTitle = computed(() => (isTitleCollapsed.value ? 'Yêu cầu truy cập' : null))
watchEffect(() => {
  headerTitle.value = compactTitle.value
})
onBeforeUnmount(() => {
  // A newer page can claim this slot before this instance unmounts during a
  // page transition — only clear it if it's still ours.
  if (headerTitle.value === compactTitle.value) headerTitle.value = null
})

const toast = useToast()
const { selectedStatus, requests, isLoading, error: listError, approve, reject } = useAccessRequests()
const { data: buildingsData } = useFetch<ApiSuccess<Building[]>>('/api/buildings', {
  query: { limit: 100, sort: 'name', order: 'asc' },
})
const { data: tenantAccountsData } = useFetch<ApiSuccess<TenantAccountListItem[]>>('/api/tenant-accounts')
const selectedRequest = ref<AccessRequest | null>(null)
const tenantOptions = ref<Tenant[]>([])
const tenantSearching = ref(false)
let tenantSearchTimer: ReturnType<typeof setTimeout> | null = null
let tenantSearchRequestId = 0

const buildings = computed(() => buildingsData.value?.data ?? [])
const linkedTenantIds = computed(() => new Set((tenantAccountsData.value?.data ?? []).map(account => account.tenantId)))
const tenants = computed(() => tenantOptions.value.filter(tenant =>
  !linkedTenantIds.value.has(tenant.id) || tenant.id === selectedRequest.value?.decisionTenantId,
))
const statusOptions = [
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'processing', label: 'Cần tiếp tục' },
  { value: 'approved', label: 'Đã duyệt' },
  { value: 'rejected', label: 'Đã từ chối' },
]
const pendingCount = useAccessRequestPendingCount(true)
const statusTabs = computed<UiTabItem[]>(() => statusOptions.map(option => ({
  key: option.value,
  label: option.label,
  count: option.value === 'pending' && pendingCount.value ? pendingCount.value : undefined,
})))
const roleOptions = [
  { value: 'owner', label: 'Chủ nhà' },
  { value: 'manager', label: 'Quản lý' },
  { value: 'tenant', label: 'Người thuê' },
]

const approvalOpen = ref(false)
const rejectionOpen = ref(false)
const selectedRole = ref<ApprovableRole>('manager')
const selectedBuildingIds = ref<string[]>([])
const selectedTenant = ref<Tenant | null>(null)
const rejectionReason = ref('')
const formError = ref<string | null>(null)
const busy = ref(false)

async function searchTenants(query = '') {
  const requestId = ++tenantSearchRequestId
  tenantSearching.value = true
  try {
    const response = await apiFetch<ApiSuccess<Tenant[]>>('/api/tenants', {
      query: { q: query.trim() || undefined, limit: 20, sort: 'full_name', order: 'asc' },
    })
    if (requestId !== tenantSearchRequestId) return
    tenantOptions.value = response.data
    if (selectedTenant.value && !tenantOptions.value.some(tenant => tenant.id === selectedTenant.value?.id)) {
      tenantOptions.value.unshift(selectedTenant.value)
    }
  }
  catch (error) {
    if (requestId !== tenantSearchRequestId) return
    formError.value = getApiErrorMessage(error, 'Không thể tìm người thuê.')
  }
  finally {
    if (requestId === tenantSearchRequestId) tenantSearching.value = false
  }
}

function queueTenantSearch(query: string) {
  if (tenantSearchTimer) clearTimeout(tenantSearchTimer)
  tenantSearchTimer = setTimeout(() => searchTenants(query), 250)
}

onBeforeUnmount(() => {
  if (tenantSearchTimer) clearTimeout(tenantSearchTimer)
})

async function openApproval(request: AccessRequest) {
  selectedRequest.value = request
  selectedRole.value = request.decisionRole ?? 'manager'
  selectedBuildingIds.value = [...request.decisionBuildingIds]
  selectedTenant.value = null
  formError.value = null
  approvalOpen.value = true
  if (request.decisionTenantId) {
    try {
      const response = await apiFetch<ApiSuccess<Tenant>>(`/api/tenants/${request.decisionTenantId}`)
      selectedTenant.value = response.data
      tenantOptions.value = [response.data]
    }
    catch {
      await searchTenants()
    }
  }
  else {
    await searchTenants()
  }
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
  if (selectedRole.value === 'tenant' && !selectedTenant.value) {
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
      ? { role: 'tenant', tenant_id: selectedTenant.value!.id }
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

function roleLabel(role: string | null | undefined) {
  return roleOptions.find(option => option.value === role)?.label ?? '—'
}

function providerLabel(provider: string) {
  if (provider === 'google') return 'Google'
  if (provider === 'email' || provider === 'password') return 'Email'
  return provider.charAt(0).toLocaleUpperCase('vi') + provider.slice(1)
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
</script>

<template>
  <div class="space-y-6">
    <UiPageHeader
      title="Yêu cầu truy cập"
      description="Duyệt danh tính mới, gán vai trò và phạm vi trước khi họ vào hệ thống."
      back-to="/dashboard/settings"
      :back-link="false"
      :reserve-global-actions="false"
    >
      <div ref="titleSentinel" aria-hidden="true" />
    </UiPageHeader>

    <UiTabs
      class="mb-4"
      :model-value="selectedStatus"
      :tabs="statusTabs"
      variant="segmented"
      @update:model-value="selectedStatus = $event as AccessRequestStatus"
    />

    <UiAlert v-if="listError" severity="danger" title="Không thể tải hàng đợi">
      {{ getApiErrorMessage(listError, 'Hãy tải lại trang và thử lại.') }}
    </UiAlert>

    <div v-else-if="isLoading" class="space-y-2" aria-busy="true">
      <UiSkeleton v-for="i in 3" :key="i" class="h-16 w-full" />
    </div>

    <UiEmptyState
      v-else-if="requests.length === 0"
      title="Không có yêu cầu"
      description="Hàng đợi ở trạng thái này đang trống."
    />

    <ul
      v-else
      role="list"
      class="-mx-4 divide-y divide-ui-border border-y border-ui-border bg-ui-surface sm:mx-0 sm:overflow-hidden sm:rounded-lg sm:border"
    >
      <li
        v-for="row in requests"
        :key="row.id"
        :data-request-id="row.id"
        class="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center"
      >
        <div class="flex min-w-0 flex-1 items-center gap-3">
          <span
            class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ui-accent/15 text-xs font-semibold text-ui-accent"
            aria-hidden="true"
          >
            {{ userInitials(row.fullName, row.email) }}
          </span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-ui-primary">{{ row.fullName || 'Chưa cung cấp tên' }}</p>
            <p class="flex flex-col text-xs text-ui-muted sm:flex-row sm:gap-1">
              <span class="truncate" :title="row.email">{{ row.email }}</span>
              <span class="shrink-0" data-request-meta><span class="hidden sm:inline">· </span>{{ providerLabel(row.provider) }} · {{ formatDate(row.createdAt) }}</span>
            </p>
          </div>
        </div>
        <div class="flex items-center justify-end gap-2 sm:shrink-0">
          <template v-if="row.status === 'pending' || row.status === 'processing'">
            <UiButton v-if="row.status === 'pending'" class="min-h-11 sm:min-h-0" size="sm" variant="ghost" :aria-label="`Từ chối yêu cầu của ${row.fullName || row.email}`" @click="openRejection(row)">Từ chối</UiButton>
            <UiBadge v-if="!row.emailVerified" variant="warning">Chưa xác minh email</UiBadge>
            <UiButton v-else class="min-h-11 sm:min-h-0" size="sm" :aria-label="`${row.status === 'processing' ? 'Tiếp tục duyệt' : 'Duyệt'} yêu cầu của ${row.fullName || row.email}`" @click="openApproval(row)">{{ row.status === 'processing' ? 'Tiếp tục' : 'Duyệt' }}</UiButton>
          </template>
          <UiBadge v-else-if="row.status === 'approved'" variant="neutral">{{ roleLabel(row.decisionRole) }}</UiBadge>
          <span v-else class="text-xs text-ui-muted">Đã từ chối</span>
        </div>
      </li>
    </ul>

    <UiModal :open="approvalOpen" title="Duyệt yêu cầu truy cập" size="md" @close="approvalOpen = false">
      <div class="space-y-5">
        <UiAlert severity="info">Role được ghi sau cùng. Nếu Auth gián đoạn, dùng lại đúng quyết định để tiếp tục an toàn.</UiAlert>
        <UiSelect v-model="selectedRole" label="Vai trò" :options="roleOptions" required />
        <div v-if="selectedRole !== 'tenant'" class="space-y-3">
          <p class="text-sm font-medium text-ui-primary">Phạm vi tòa nhà</p>
          <div class="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-ui-border bg-ui-surface p-3">
            <UiCheckbox
              v-for="building in buildings"
              :key="building.id"
              :model-value="selectedBuildingIds.includes(building.id)"
              :label="building.name"
              @update:model-value="toggleBuilding(building.id, $event)"
            />
          </div>
        </div>
        <UiCombobox
          v-else
          v-model="selectedTenant"
          label="Người thuê chưa có tài khoản"
          placeholder="Chọn người thuê"
          search-placeholder="Tìm theo tên, mã, số điện thoại hoặc CCCD"
          :options="tenants"
          :option-key="tenant => tenant.id"
          :option-label="tenant => `${tenant.fullName} · ${tenant.code}`"
          :loading="tenantSearching"
          remote-search
          required
          @search="queueTenantSearch"
        />
        <UiAlert v-if="formError" severity="danger" role="alert">{{ formError }}</UiAlert>
      </div>
      <template #footer>
        <UiButton class="min-h-11 sm:min-h-0" variant="ghost" :disabled="busy" @click="approvalOpen = false">Huỷ</UiButton>
        <UiButton class="min-h-11 sm:min-h-0" :loading="busy" @click="submitApproval">Duyệt và cấp quyền</UiButton>
      </template>
    </UiModal>

    <UiModal :open="rejectionOpen" title="Từ chối yêu cầu" size="sm" @close="rejectionOpen = false">
      <div class="space-y-4">
        <UiTextarea v-model="rejectionReason" label="Lý do" placeholder="Nêu lý do để người đăng ký biết cần xử lý gì" :disabled="busy" required />
        <UiAlert v-if="formError" severity="danger" role="alert">{{ formError }}</UiAlert>
      </div>
      <template #footer>
        <UiButton class="min-h-11 sm:min-h-0" variant="ghost" :disabled="busy" @click="rejectionOpen = false">Huỷ</UiButton>
        <UiButton class="min-h-11 sm:min-h-0" variant="danger" :loading="busy" @click="submitRejection">Xác nhận từ chối</UiButton>
      </template>
    </UiModal>
  </div>
</template>
