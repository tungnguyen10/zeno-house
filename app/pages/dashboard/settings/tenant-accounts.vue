<script setup lang="ts">
import type { UiTableColumn } from '~/components/ui/UiTable.vue'
import type { Tenant } from '~/types/tenants'
import type { ApiSuccess } from '~/types/api'
import type {
  TenantAccountCredentials,
  TenantAccountListItem,
  TenantAccountOrphan,
  TenantAccountRemovalOutcome,
} from '~/types/tenant-accounts'
import { getApiErrorMessage } from '~/utils/api-error'

definePageMeta({
  middleware: () => {
    const authStore = useAuthStore()
    if (!authStore.can('tenant.account.provision')) return navigateTo('/dashboard')
  },
})

const toast = useToast()
const authStore = useAuthStore()
const {
  accounts,
  status,
  error,
  orphans,
  orphansLoading,
  orphansError,
  loadOrphans,
  provision,
  setStatus,
  resetPassword,
  revoke,
  reconcileOrphan,
}
  = useTenantAccounts()
const canReconcileOrphans = computed(() => authStore.can('users.manage.global'))
const columns: UiTableColumn<TenantAccountListItem>[] = [
  { key: 'tenant', label: 'Khách thuê' },
  { key: 'email', label: 'Email đăng nhập', hideOnMobile: true },
  { key: 'health', label: 'Liên kết' },
  { key: 'actions', action: true, width: 'w-80' },
]

// ── Provision + tenant search ────────────────────────────────────────────────
const provisionOpen = ref(false)
const searchResults = ref<Tenant[]>([])
const searching = ref(false)
const selectedTenant = ref<Tenant | null>(null)
const provisionEmail = ref('')
const provisionBusy = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | null = null
let tenantSearchRequestId = 0

const availableTenants = computed(() => {
  const linkedIds = new Set(accounts.value.map(account => account.tenantId))
  return searchResults.value.filter(tenant =>
    !linkedIds.has(tenant.id) || tenant.id === selectedTenant.value?.id,
  )
})

watch(selectedTenant, tenant => {
  if (tenant) provisionEmail.value = tenant.email ?? ''
})

function queueTenantSearch(query: string) {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => runSearch(query), 300)
}

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
})

async function runSearch(query: string) {
  const requestId = ++tenantSearchRequestId
  searching.value = true
  try {
    const res = await apiFetch<ApiSuccess<Tenant[]>>('/api/tenants', {
      query: { q: query.trim() || undefined, limit: 20, sort: 'full_name', order: 'asc' },
    })
    if (requestId !== tenantSearchRequestId) return
    searchResults.value = res.data ?? []
    if (selectedTenant.value && !searchResults.value.some(tenant => tenant.id === selectedTenant.value?.id)) {
      searchResults.value.unshift(selectedTenant.value)
    }
  }
  catch (e) {
    if (requestId !== tenantSearchRequestId) return
    toast.error(getApiErrorMessage(e))
  }
  finally {
    if (requestId === tenantSearchRequestId) searching.value = false
  }
}

function openProvision() {
  searchResults.value = []
  selectedTenant.value = null
  provisionEmail.value = ''
  provisionOpen.value = true
  void runSearch('')
}

async function handleProvision() {
  if (!selectedTenant.value) {
    toast.error('Hãy chọn người thuê.')
    return
  }
  if (!provisionEmail.value.trim()) {
    toast.error('Hãy nhập email đăng nhập.')
    return
  }
  provisionBusy.value = true
  try {
    const cred = await provision(selectedTenant.value.id, { email: provisionEmail.value.trim() })
    provisionOpen.value = false
    showCredentials(cred)
    toast.success('Đã cấp tài khoản.')
  }
  catch (e) {
    toast.error(getApiErrorMessage(e, 'Không thể cấp tài khoản.'))
  }
  finally {
    provisionBusy.value = false
  }
}

// ── One-time credentials ─────────────────────────────────────────────────────
const credentials = ref<TenantAccountCredentials | null>(null)
const credentialsOpen = ref(false)

function showCredentials(cred: TenantAccountCredentials) {
  credentials.value = cred
  credentialsOpen.value = true
}

function closeCredentials() {
  credentialsOpen.value = false
  credentials.value = null
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success('Đã sao chép.')
  }
  catch {
    toast.error('Không sao chép được.')
  }
}

// ── Row lifecycle actions ────────────────────────────────────────────────────
const busyTenantId = ref<string | null>(null)

async function toggleStatus(item: TenantAccountListItem) {
  if (item.health !== 'linked') return
  busyTenantId.value = item.tenantId
  try {
    await setStatus(item.tenantId, item.status === 'active' ? 'disabled' : 'active')
    toast.success(item.status === 'active' ? 'Đã khoá tài khoản.' : 'Đã mở lại tài khoản.')
  }
  catch (e) {
    toast.error(getApiErrorMessage(e))
  }
  finally {
    busyTenantId.value = null
  }
}

const resetTarget = ref<TenantAccountListItem | null>(null)
const resetBusy = ref(false)

async function confirmReset() {
  if (!resetTarget.value || resetTarget.value.health !== 'linked') return
  resetBusy.value = true
  try {
    const cred = await resetPassword(resetTarget.value.tenantId)
    resetTarget.value = null
    showCredentials(cred)
    toast.success('Đã đặt lại mật khẩu.')
  }
  catch (e) {
    toast.error(getApiErrorMessage(e))
  }
  finally {
    resetBusy.value = false
  }
}

const revokeTarget = ref<TenantAccountListItem | null>(null)
const revokeBusy = ref(false)

async function confirmRevoke() {
  if (!revokeTarget.value) return
  revokeBusy.value = true
  try {
    const result = await revoke(revokeTarget.value.tenantId)
    revokeTarget.value = null
    toast.success(removalMessage(result.outcome))
  }
  catch (e) {
    toast.error(getApiErrorMessage(e))
  }
  finally {
    revokeBusy.value = false
  }
}

const revokeMessage = computed(() =>
  revokeTarget.value
    ? `Gỡ quyền truy cập portal của ${revokeTarget.value.tenantName}? Quyền truy cập sẽ bị chặn trước. Hệ thống sẽ xóa tài khoản Auth nếu an toàn; nếu còn dữ liệu tham chiếu, tài khoản sẽ được vô hiệu hóa để bảo toàn lịch sử.`
    : '',
)

function removalMessage(outcome: TenantAccountRemovalOutcome): string {
  return outcome === 'deleted'
    ? 'Đã xóa tài khoản Auth và giải phóng email.'
    : 'Đã vô hiệu hóa tài khoản và gỡ liên kết portal; dữ liệu lịch sử được giữ lại.'
}

const orphanTarget = ref<TenantAccountOrphan | null>(null)
const orphanBusy = ref(false)

async function confirmReconcileOrphan() {
  if (!orphanTarget.value) return
  orphanBusy.value = true
  try {
    const result = await reconcileOrphan(orphanTarget.value.authUserId)
    orphanTarget.value = null
    toast.success(removalMessage(result.outcome))
  }
  catch (error) {
    toast.error(getApiErrorMessage(error, 'Không thể xử lý tài khoản mồ côi.'))
  }
  finally {
    orphanBusy.value = false
  }
}

onMounted(() => {
  if (canReconcileOrphans.value) void loadOrphans()
})
</script>

<template>
  <div>
    <UiPageHeader
      title="Tài khoản người thuê"
      description="Cấp và quản lý tài khoản đăng nhập portal cho khách thuê đã có trong hệ thống."
    >
      <template #actions>
        <UiButton variant="primary" @click="openProvision">
          <IconPlus class="h-4 w-4" aria-hidden="true" />
          Cấp tài khoản
        </UiButton>
      </template>
    </UiPageHeader>

    <UiAlert v-if="error" severity="danger" title="Không tải được danh sách">
      {{ getApiErrorMessage(error, 'Hãy tải lại trang và thử lại.') }}
    </UiAlert>

    <UiTable
      v-else
      :rows="accounts"
      :columns="columns"
      row-key="tenantId"
      :loading="status === 'pending'"
      caption="Danh sách tài khoản portal của người thuê"
      empty-title="Chưa có tài khoản nào"
      empty-description="Nhấn “Cấp tài khoản” để tạo tài khoản portal cho một khách thuê."
    >
      <template #cell-tenant="{ row }">
        <div class="min-w-40">
          <p class="font-medium text-white">{{ row.tenantName }}</p>
          <p class="text-xs text-muted">{{ row.tenantCode }}</p>
          <p class="mt-1 break-all text-xs text-muted md:hidden">{{ row.email ?? 'Không có email Auth' }}</p>
        </div>
      </template>
      <template #cell-email="{ row }">
        <span :class="row.email ? 'text-white' : 'text-warning'">{{ row.email ?? 'Không tìm thấy' }}</span>
      </template>
      <template #cell-health="{ row }">
        <UiStatusBadge :status="row.health === 'missing_auth' ? row.health : row.status" />
      </template>
      <template #cell-actions="{ row }">
        <div class="flex min-w-52 flex-wrap items-center justify-end gap-2">
          <UiButton
            variant="secondary"
            size="sm"
            :loading="busyTenantId === row.tenantId"
            :disabled="row.health !== 'linked' || busyTenantId === row.tenantId"
            @click="toggleStatus(row)"
          >
            {{ row.status === 'active' ? 'Khóa' : 'Mở lại' }}
          </UiButton>
          <UiButton
            variant="secondary"
            size="sm"
            :disabled="row.health !== 'linked'"
            @click="resetTarget = row"
          >
            Đặt lại mật khẩu
          </UiButton>
          <UiButton variant="danger" size="sm" @click="revokeTarget = row">
            {{ row.health === 'missing_auth' ? 'Dọn liên kết' : 'Gỡ' }}
          </UiButton>
        </div>
      </template>
    </UiTable>

    <section v-if="canReconcileOrphans" class="mt-8 space-y-3" aria-labelledby="orphan-heading">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="orphan-heading" class="text-lg font-semibold text-white">Tài khoản Auth mồ côi</h2>
          <p class="mt-1 text-sm text-muted">Tài khoản mang vai trò tenant nhưng không còn liên kết tới hồ sơ người thuê.</p>
        </div>
        <UiButton variant="secondary" size="sm" :loading="orphansLoading" @click="loadOrphans">
          Kiểm tra lại
        </UiButton>
      </div>
      <UiAlert v-if="orphansError" severity="danger" title="Không thể kiểm tra tài khoản mồ côi">
        {{ getApiErrorMessage(orphansError, 'Hãy thử lại sau.') }}
      </UiAlert>
      <div v-else-if="orphansLoading" class="space-y-2">
        <UiSkeleton v-for="n in 2" :key="n" class="h-16 w-full" />
      </div>
      <UiEmptyState
        v-else-if="orphans.length === 0"
        title="Không phát hiện tài khoản mồ côi"
        description="Mọi tài khoản tenant hiện có đều đang được liên kết."
      />
      <div v-else class="space-y-2">
        <article
          v-for="orphan in orphans"
          :key="orphan.authUserId"
          class="flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning/5 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <p class="break-all font-medium text-white">{{ orphan.email ?? 'Không có email' }}</p>
              <UiStatusBadge status="orphaned" />
            </div>
            <p class="mt-1 text-xs text-muted">
              Tạo ngày {{ new Date(orphan.createdAt).toLocaleDateString('vi-VN') }}
              <span v-if="orphan.lastSignInAt"> · Đăng nhập gần nhất {{ new Date(orphan.lastSignInAt).toLocaleDateString('vi-VN') }}</span>
            </p>
          </div>
          <UiButton variant="danger" size="sm" @click="orphanTarget = orphan">Xử lý tài khoản</UiButton>
        </article>
      </div>
    </section>

    <!-- Provision modal -->
    <UiModal :open="provisionOpen" title="Cấp tài khoản người thuê" size="md" @close="provisionOpen = false">
      <div class="space-y-4">
        <UiCombobox
          v-model="selectedTenant"
          label="Chọn khách thuê"
          placeholder="Chọn người thuê chưa có tài khoản"
          search-placeholder="Tìm theo tên, mã, số điện thoại hoặc CCCD"
          :options="availableTenants"
          :option-key="tenant => tenant.id"
          :option-label="tenant => `${tenant.fullName} · ${tenant.code} · ${tenant.phone}`"
          :loading="searching"
          remote-search
          required
          @search="queueTenantSearch"
        />

        <div v-if="selectedTenant" class="rounded-lg border border-dark-border bg-dark-surface p-3">
          <p class="text-sm font-medium text-white">{{ selectedTenant.fullName }}</p>
          <p class="text-xs text-muted">{{ selectedTenant.code }}</p>
          <div v-if="selectedTenant.activeAssignment" class="mt-2 border-t border-dark-border pt-2">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-xs text-muted">
                Phòng {{ selectedTenant.activeAssignment.roomNumber }} · {{ selectedTenant.activeAssignment.buildingName }}
              </span>
              <span
                v-if="selectedTenant.activeAssignment.assignmentRole === 'roommate'"
                class="rounded-full bg-cyan/10 px-2 py-0.5 text-xs font-medium text-cyan"
              >
                Người ở cùng
              </span>
            </div>
            <p
              v-if="selectedTenant.activeAssignment.assignmentRole === 'roommate' && selectedTenant.activeAssignment.primaryTenantName"
              class="mt-1 text-xs text-muted"
            >
              Người đứng hợp đồng: {{ selectedTenant.activeAssignment.primaryTenantName }}
            </p>
          </div>
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-white">Email đăng nhập</label>
          <UiInput v-model="provisionEmail" type="email" placeholder="email@vidu.com" />
          <p class="mt-1 text-xs text-muted">Mật khẩu tạm sẽ được tạo và hiển thị một lần sau khi cấp.</p>
        </div>
      </div>

      <template #footer>
        <UiButton variant="secondary" @click="provisionOpen = false">Huỷ</UiButton>
        <UiButton
          variant="primary"
          :loading="provisionBusy"
          :disabled="!selectedTenant"
          @click="handleProvision"
        >
          Cấp tài khoản
        </UiButton>
      </template>
    </UiModal>

    <!-- One-time credentials modal -->
    <UiModal :open="credentialsOpen" title="Thông tin đăng nhập" size="sm" @close="closeCredentials">
      <div v-if="credentials" class="space-y-3">
        <UiAlert severity="warning">
          Mật khẩu tạm chỉ hiển thị một lần. Hãy gửi cho khách thuê và yêu cầu đổi sau khi đăng nhập.
        </UiAlert>
        <div class="rounded-lg border border-dark-border">
          <div class="flex items-center justify-between gap-2 border-b border-dark-border px-3 py-2">
            <div class="min-w-0">
              <p class="text-xs text-muted">Email</p>
              <p class="truncate text-sm text-white">{{ credentials.email }}</p>
            </div>
            <UiButton variant="secondary" size="sm" @click="copyText(credentials.email)">Sao chép</UiButton>
          </div>
          <div class="flex items-center justify-between gap-2 px-3 py-2">
            <div class="min-w-0">
              <p class="text-xs text-muted">Mật khẩu tạm</p>
              <p class="truncate font-mono text-sm text-white">{{ credentials.tempPassword }}</p>
            </div>
            <UiButton variant="secondary" size="sm" @click="copyText(credentials.tempPassword)">Sao chép</UiButton>
          </div>
        </div>
      </div>
      <template #footer>
        <UiButton variant="primary" @click="closeCredentials">Đã hiểu</UiButton>
      </template>
    </UiModal>

    <!-- Reset confirm -->
    <UiConfirmModal
      :open="resetTarget !== null"
      title="Đặt lại mật khẩu"
      :message="resetTarget ? `Tạo mật khẩu tạm mới cho ${resetTarget.tenantName}? Mật khẩu cũ sẽ ngừng hoạt động.` : ''"
      confirm-label="Đặt lại"
      :loading="resetBusy"
      @confirm="confirmReset"
      @cancel="resetTarget = null"
    />

    <!-- Revoke confirm -->
    <UiConfirmModal
      :open="revokeTarget !== null"
      title="Gỡ tài khoản"
      :message="revokeMessage"
      confirm-label="Gỡ tài khoản"
      :loading="revokeBusy"
      @confirm="confirmRevoke"
      @cancel="revokeTarget = null"
    />

    <UiConfirmModal
      :open="orphanTarget !== null"
      title="Xử lý tài khoản Auth mồ côi"
      :message="orphanTarget
        ? `Xử lý ${orphanTarget.email ?? 'tài khoản không có email'}? Hệ thống sẽ xóa Auth user nếu an toàn; nếu còn tham chiếu lịch sử, tài khoản sẽ được vô hiệu hóa.`
        : ''"
      confirm-label="Xử lý tài khoản"
      :loading="orphanBusy"
      @confirm="confirmReconcileOrphan"
      @cancel="orphanTarget = null"
    />
  </div>
</template>
