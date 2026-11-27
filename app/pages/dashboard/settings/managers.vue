<script setup lang="ts">
import type { UiTabItem } from '~/components/ui/UiTabs.vue'
import type { ManagedUserWithAssignments } from '~/types/users'
import { ROLES, type CreatableRole } from '~/utils/constants/roles'
import type { UserCreateInput, UserUpdateInput } from '~/utils/validators/users'
import { getApiErrorMessage } from '~/utils/api-error'

definePageMeta({
  middleware: () => {
    const authStore = useAuthStore()
    if (!authStore.canManageUsers) return navigateTo('/dashboard')
  },
})

// Mobile large-title collapse: fades into the persistent app header once scrolled past.
const titleSentinel = ref<HTMLElement | null>(null)
const isTitleCollapsed = ref(false)
useIntersectionObserver(titleSentinel, ([entry]) => {
  isTitleCollapsed.value = !!entry && !entry.isIntersecting
})
const headerTitle = useAppHeaderTitle()
const compactTitle = computed(() => (isTitleCollapsed.value ? 'Người dùng' : null))
watchEffect(() => {
  headerTitle.value = compactTitle.value
})
onBeforeUnmount(() => {
  if (headerTitle.value === compactTitle.value) headerTitle.value = null
})

const authStore = useAuthStore()
const toast = useToast()
const {
  users,
  buildings,
  buildingsWithoutManager,
  isLoading,
  error,
  refresh,
  createUser,
  updateUser,
  deleteUser,
  assign,
  toggle,
  unassign,
} = useManagerAssignments()

const roleOptions = computed(() => {
  const options: { value: CreatableRole; label: string }[] = [{ value: ROLES.MANAGER, label: 'Quản lý' }]
  if (authStore.canCreateOwner) options.unshift({ value: ROLES.OWNER, label: 'Chủ nhà' })
  return options
})
const defaultRole = computed<CreatableRole>(() => (authStore.canCreateOwner ? ROLES.OWNER : ROLES.MANAGER))
const buildingChoices = computed(() => buildings.value.map(b => ({ id: b.id, name: b.name })))

// Owners manage only managers; admins manage everyone shown.
function canManageRow(row: ManagedUserWithAssignments): boolean {
  return authStore.isAdmin || row.user.role === ROLES.MANAGER
}

// List filtering ----------------------------------------------------------------
const query = ref('')
const roleFilter = ref('all')
const roleTabs = computed<UiTabItem[]>(() => [
  { key: 'all', label: 'Tất cả', count: users.value.length },
  { key: ROLES.OWNER, label: 'Chủ nhà', count: users.value.filter(r => r.user.role === ROLES.OWNER).length },
  { key: ROLES.MANAGER, label: 'Quản lý', count: users.value.filter(r => r.user.role === ROLES.MANAGER).length },
])
const filteredUsers = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase('vi')
  return users.value.filter(row =>
    (roleFilter.value === 'all' || row.user.role === roleFilter.value)
    && (!needle || [row.user.name, row.user.email].some(value => value?.toLocaleLowerCase('vi').includes(needle))),
  )
})

// Create ----------------------------------------------------------------------
const createOpen = ref(false)
const createBusy = ref(false)
const createError = ref<string | null>(null)

function openCreate() {
  createError.value = null
  createOpen.value = true
}

async function handleCreate(payload: UserCreateInput) {
  createBusy.value = true
  createError.value = null
  try {
    await createUser(payload)
    createOpen.value = false
    toast.success('Đã tạo người dùng. Hãy gửi email và mật khẩu cho họ.')
  }
  catch (err: unknown) {
    const message = getApiErrorMessage(err, 'Không thể tạo người dùng.')
    createError.value = message
    toast.error(message)
  }
  finally {
    createBusy.value = false
  }
}

// Drawer ----------------------------------------------------------------------
const selectedUserId = ref<string | null>(null)
const selectedRow = computed(() => users.value.find(row => row.user.id === selectedUserId.value) ?? null)
const editing = ref(false)
const busyKey = ref<string | null>(null)
const addButton = ref<{ $el?: HTMLElement } | null>(null)

async function run(key: string, action: () => Promise<unknown>, success: string, failure: string): Promise<boolean> {
  busyKey.value = key
  try {
    await action()
    toast.success(success)
    return true
  }
  catch (err: unknown) {
    toast.error(getApiErrorMessage(err, failure))
    return false
  }
  finally {
    busyKey.value = null
  }
}

async function handleUpdate(id: string, payload: UserUpdateInput) {
  if (await run(`update:${id}`, () => updateUser(id, payload), 'Đã cập nhật người dùng.', 'Không thể cập nhật người dùng.')) {
    editing.value = false
  }
}

function handleAssign(userId: string, buildingId: string) {
  void run(`assign:${userId}`, () => assign({ user_id: userId, building_id: buildingId }), 'Đã gán vào tòa nhà.', 'Không thể gán vào tòa nhà.')
}

function handleToggle(assignmentId: string, value: boolean) {
  void run(`toggle:${assignmentId}`, () => toggle(assignmentId, { can_delete_master_data: value }), 'Đã cập nhật quyền xoá dữ liệu.', 'Không thể cập nhật quyền xoá dữ liệu.')
}

function handleUnassign(assignmentId: string) {
  void run(`unassign:${assignmentId}`, () => unassign(assignmentId), 'Đã bỏ gán khỏi tòa nhà.', 'Không thể bỏ gán khỏi tòa nhà.')
}

async function handleRemove(id: string) {
  if (await run(`delete:${id}`, () => deleteUser(id), 'Đã xoá người dùng.', 'Không thể xoá người dùng.')) {
    selectedUserId.value = null
    // The opener row is gone; give focus a stable home.
    await nextTick()
    addButton.value?.$el?.focus()
  }
}
</script>

<template>
  <div>
    <UiPageHeader
      title="Người dùng"
      :description="authStore.isAdmin
        ? 'Chủ nhà và quản lý, phạm vi theo tòa nhà và quyền xoá dữ liệu.'
        : 'Quản lý trong phạm vi tòa nhà của bạn.'"
      back-to="/dashboard/settings"
      back-mobile-only
      :reserve-global-actions="false"
    >
      <div ref="titleSentinel" aria-hidden="true" />
      <template #actions>
        <UiButton ref="addButton" class="min-h-11 sm:min-h-0" @click="openCreate">
          <IconPlus class="h-4 w-4" aria-hidden="true" />
          Thêm người dùng
        </UiButton>
      </template>
    </UiPageHeader>

    <UiAlert
      v-if="buildingsWithoutManager.length > 0"
      class="mb-4"
      severity="warning"
      :title="`${buildingsWithoutManager.length} tòa nhà chưa có quản lý`"
    >
      {{ buildingsWithoutManager.map(building => building.name).join(', ') }}
    </UiAlert>

    <div v-if="users.length > 0" class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
      <UiSearchInput
        v-model="query"
        placeholder="Tìm theo tên hoặc email"
        aria-label="Tìm người dùng"
        density="normal"
        class="sm:max-w-xs sm:flex-1 [&_input]:min-h-11 sm:[&_input]:min-h-0"
      />
      <UiTabs
        v-if="authStore.isAdmin"
        v-model="roleFilter"
        :tabs="roleTabs"
        variant="segmented"
        class="[&_[role=tab]]:min-h-11 [&_[role=tab]]:shrink-0 [&_[role=tab]]:whitespace-nowrap [&_[role=tab]]:px-2.5 sm:[&_[role=tab]]:min-h-0 sm:[&_[role=tab]]:px-3.5 lg:[&_[role=tab]]:px-4"
      />
    </div>

    <UiAlert v-if="error" severity="danger" title="Không tải được danh sách người dùng">
      <p>{{ getApiErrorMessage(error, 'Hãy thử lại sau.') }}</p>
      <UiButton class="mt-2 min-h-11 sm:min-h-0" size="sm" variant="secondary" @click="refresh()">Thử lại</UiButton>
    </UiAlert>

    <div v-else-if="isLoading && users.length === 0" class="space-y-2">
      <UiSkeleton v-for="i in 4" :key="i" class="h-14 w-full" />
    </div>

    <UiEmptyState
      v-else-if="users.length === 0"
      title="Chưa có người dùng nào"
      description="Thêm chủ nhà hoặc quản lý để bắt đầu phân quyền tòa nhà."
    />

    <UiEmptyState
      v-else-if="filteredUsers.length === 0"
      variant="search"
      title="Không tìm thấy người dùng"
      description="Thử từ khoá khác hoặc bỏ bộ lọc vai trò."
    />

    <ul
      v-else
      role="list"
      class="-mx-4 divide-y divide-ui-border border-y border-ui-border bg-ui-surface sm:mx-0 sm:overflow-hidden sm:rounded-lg sm:border"
    >
      <li v-for="row in filteredUsers" :key="row.user.id">
        <UserListRow :row="row" :manageable="canManageRow(row)" @open="selectedUserId = $event" />
      </li>
    </ul>

    <UserCreateModal
      :open="createOpen"
      :buildings="buildingChoices"
      :role-options="roleOptions"
      :default-role="defaultRole"
      :busy="createBusy"
      :error="createError"
      @close="createOpen = false"
      @submit="handleCreate"
    />

    <UserDetailDrawer
      v-model:editing="editing"
      :row="selectedRow"
      :buildings="buildingChoices"
      :role-options="roleOptions"
      :can-edit-role="authStore.isAdmin"
      :busy-key="busyKey"
      @close="selectedUserId = null"
      @update="handleUpdate"
      @assign="handleAssign"
      @toggle-delete="handleToggle"
      @unassign="handleUnassign"
      @remove="handleRemove"
    />
  </div>
</template>
