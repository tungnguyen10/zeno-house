<script setup lang="ts">
import type { Tenant } from '~/types/tenants'
import type { ApiSuccess } from '~/types/api'
import type { TenantAccountCredentials, TenantAccountListItem } from '~/types/tenant-accounts'
import { getApiErrorMessage } from '~/utils/api-error'

definePageMeta({
  middleware: () => {
    const authStore = useAuthStore()
    if (!authStore.can('tenant.account.provision')) return navigateTo('/dashboard')
  },
})

const toast = useToast()
const { accounts, status, error, provision, setStatus, resetPassword, revoke }
  = useTenantAccounts()

// ── Provision + tenant search ────────────────────────────────────────────────
const provisionOpen = ref(false)
const search = ref('')
const searchResults = ref<Tenant[]>([])
const searching = ref(false)
const selectedTenant = ref<Tenant | null>(null)
const provisionEmail = ref('')
const provisionBusy = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | null = null

watch(search, (query) => {
  if (selectedTenant.value && query !== selectedTenant.value.fullName) selectedTenant.value = null
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => runSearch(query), 300)
})

async function runSearch(query: string) {
  if (!query.trim() || selectedTenant.value) {
    searchResults.value = []
    return
  }
  searching.value = true
  try {
    const res = await apiFetch<ApiSuccess<Tenant[]>>('/api/tenants', {
      query: { q: query, limit: 20 },
    })
    searchResults.value = res.data ?? []
  }
  catch (e) {
    toast.error(getApiErrorMessage(e))
  }
  finally {
    searching.value = false
  }
}

function openProvision() {
  search.value = ''
  searchResults.value = []
  selectedTenant.value = null
  provisionEmail.value = ''
  provisionOpen.value = true
}

function pickTenant(tenant: Tenant) {
  selectedTenant.value = tenant
  provisionEmail.value = tenant.email ?? ''
  searchResults.value = []
  search.value = tenant.fullName
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
  if (!resetTarget.value) return
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
    await revoke(revokeTarget.value.tenantId)
    revokeTarget.value = null
    toast.success('Đã gỡ tài khoản.')
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
    ? `Gỡ tài khoản của ${revokeTarget.value.tenantName}? Tài khoản đăng nhập sẽ bị xoá và email được giải phóng.`
    : '',
)
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

    <div v-if="status === 'pending'" class="space-y-2">
      <UiSkeleton v-for="n in 3" :key="n" class="h-16 w-full" />
    </div>

    <UiEmptyState
      v-else-if="error"
      title="Không tải được danh sách"
      description="Đã xảy ra lỗi khi tải danh sách tài khoản."
    />

    <UiEmptyState
      v-else-if="accounts.length === 0"
      title="Chưa có tài khoản nào"
      description="Nhấn “Cấp tài khoản” để tạo tài khoản portal cho một khách thuê."
    />

    <div v-else class="overflow-hidden rounded-xl border border-dark-border">
      <table class="w-full text-sm">
        <thead class="bg-dark-surface text-left text-xs text-muted">
          <tr>
            <th class="px-4 py-3 font-medium">Khách thuê</th>
            <th class="px-4 py-3 font-medium">Email đăng nhập</th>
            <th class="px-4 py-3 font-medium">Trạng thái</th>
            <th class="px-4 py-3 text-right font-medium">Thao tác</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-dark-border">
          <tr v-for="item in accounts" :key="item.tenantId" class="hover:bg-dark-hover">
            <td class="px-4 py-3">
              <p class="font-medium text-white">{{ item.tenantName }}</p>
              <p class="text-xs text-muted">{{ item.tenantCode }}</p>
            </td>
            <td class="px-4 py-3 text-white">{{ item.email ?? '—' }}</td>
            <td class="px-4 py-3">
              <span
                class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                :class="item.status === 'active'
                  ? 'bg-success-neon/15 text-success-neon'
                  : 'bg-error/15 text-error'"
              >
                {{ item.status === 'active' ? 'Đang hoạt động' : 'Đã khoá' }}
              </span>
            </td>
            <td class="px-4 py-3">
              <div class="flex items-center justify-end gap-2">
                <UiButton
                  variant="secondary"
                  size="sm"
                  :loading="busyTenantId === item.tenantId"
                  @click="toggleStatus(item)"
                >
                  {{ item.status === 'active' ? 'Khoá' : 'Mở lại' }}
                </UiButton>
                <UiButton variant="secondary" size="sm" @click="resetTarget = item">
                  Đặt lại mật khẩu
                </UiButton>
                <UiButton variant="danger" size="sm" @click="revokeTarget = item">
                  Gỡ
                </UiButton>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Provision modal -->
    <UiModal :open="provisionOpen" title="Cấp tài khoản người thuê" size="md" @close="provisionOpen = false">
      <div class="space-y-4">
        <div>
          <label class="mb-1 block text-sm font-medium text-white">Chọn khách thuê</label>
          <UiInput v-model="search" placeholder="Tìm theo tên hoặc số điện thoại" />
          <div v-if="searching" class="mt-2 text-xs text-muted">Đang tìm…</div>
          <ul
            v-else-if="searchResults.length"
            class="mt-2 max-h-56 overflow-y-auto rounded-lg border border-dark-border"
          >
            <li
              v-for="tenant in searchResults"
              :key="tenant.id"
              class="cursor-pointer px-3 py-2 hover:bg-dark-hover"
              @click="pickTenant(tenant)"
            >
              <p class="text-sm font-medium text-white">{{ tenant.fullName }}</p>
              <p class="text-xs text-muted">{{ tenant.code }} · {{ tenant.phone }}</p>
            </li>
          </ul>
        </div>

        <div v-if="selectedTenant" class="rounded-lg border border-dark-border bg-dark-surface p-3">
          <p class="text-sm font-medium text-white">{{ selectedTenant.fullName }}</p>
          <p class="text-xs text-muted">{{ selectedTenant.code }}</p>
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
    <UiModal :open="credentialsOpen" title="Thông tin đăng nhập" size="sm" @close="credentialsOpen = false">
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
        <UiButton variant="primary" @click="credentialsOpen = false">Đã hiểu</UiButton>
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
  </div>
</template>
