<script setup lang="ts">
import type { ManagedUserWithAssignments } from '~/types/users'
import { ROLES } from '~/utils/constants/roles'
import type { CreatableRole } from '~/utils/constants/roles'
import type { UserUpdateInput } from '~/utils/validators/users'

definePageMeta({
  middleware: () => {
    const authStore = useAuthStore()
    if (!authStore.canManageUsers) return navigateTo('/')
  },
})

const authStore = useAuthStore()

const {
  users,
  buildings,
  buildingsWithoutManager,
  isLoading,
  createUser,
  updateUser,
  deleteUser,
  assign,
  toggle,
  unassign,
} = useManagerAssignments()

const toast = useToast()

const selectedBuildingByUser = ref<Record<string, string>>({})
const busyKey = ref<string | null>(null)

// Create-user form ------------------------------------------------------------
const createBusy = ref(false)
const form = reactive({
  email: '',
  password: '',
  full_name: '',
  role: ROLES.MANAGER as CreatableRole,
  building_ids: [] as string[],
})

const roleOptions = computed(() => {
  const options: { value: CreatableRole; label: string }[] = [
    { value: ROLES.MANAGER, label: 'Quản lý (manager)' },
  ]
  if (authStore.canCreateOwner) {
    options.unshift({ value: ROLES.OWNER, label: 'Chủ nhà (owner)' })
  }
  return options
})

// Building assignment is optional. Owners can create managers without a building
// (the creator is recorded server-side so the manager stays visible/scoped).
// Owners can only assign buildings in their own scope (the list is server-scoped).

function toggleFormBuilding(id: string) {
  const idx = form.building_ids.indexOf(id)
  if (idx === -1) form.building_ids.push(id)
  else form.building_ids.splice(idx, 1)
}

function resetForm() {
  form.email = ''
  form.password = ''
  form.full_name = ''
  form.role = authScopedDefaultRole()
  form.building_ids = []
}

function authScopedDefaultRole(): CreatableRole {
  return authStore.canCreateOwner ? ROLES.OWNER : ROLES.MANAGER
}

async function handleCreate() {
  if (!form.email || !form.password) {
    toast.error('Cần nhập email và mật khẩu.')
    return
  }
  createBusy.value = true
  try {
    await createUser({
      email: form.email,
      password: form.password,
      full_name: form.full_name || undefined,
      role: form.role,
      building_ids: form.building_ids,
    })
    toast.success('Đã tạo người dùng. Hãy gửi email và mật khẩu cho họ.')
    resetForm()
  }
  catch (err: unknown) {
    const msg = (err as { data?: { error?: { message?: string } } })?.data?.error?.message ?? 'Không thể tạo người dùng.'
    toast.error(msg)
  }
  finally {
    createBusy.value = false
  }
}

// Edit/delete user ------------------------------------------------------------
const editingRow = ref<ManagedUserWithAssignments | null>(null)
const editBusy = ref(false)
const editForm = reactive({
  email: '',
  password: '',
  full_name: '',
  role: ROLES.MANAGER as CreatableRole,
})
const deleteTarget = ref<ManagedUserWithAssignments | null>(null)
const deleteBusy = ref(false)

const deleteMessage = computed(() => {
  const user = deleteTarget.value?.user
  const label = user?.name ?? user?.email ?? 'người dùng này'
  return `Xoá ${label} khỏi hệ thống? Hành động này sẽ thu hồi quyền đăng nhập của tài khoản.`
})

function startEdit(row: ManagedUserWithAssignments) {
  editingRow.value = row
  editForm.email = row.user.email ?? ''
  editForm.password = ''
  editForm.full_name = row.user.name ?? ''
  editForm.role = row.user.role === ROLES.OWNER ? ROLES.OWNER : ROLES.MANAGER
}

function closeEdit() {
  if (editBusy.value) return
  editingRow.value = null
  editForm.password = ''
}

async function handleUpdate() {
  if (!editingRow.value) return
  if (!editForm.email) {
    toast.error('Cần nhập email.')
    return
  }

  const payload: UserUpdateInput = {
    email: editForm.email,
    full_name: editForm.full_name,
  }
  if (editForm.password) payload.password = editForm.password
  if (authStore.isAdmin) payload.role = editForm.role

  editBusy.value = true
  try {
    await updateUser(editingRow.value.user.id, payload)
    toast.success('Đã cập nhật người dùng.')
    editingRow.value = null
    editForm.password = ''
  }
  catch (err: unknown) {
    const msg = (err as { data?: { error?: { message?: string } } })?.data?.error?.message ?? 'Không thể cập nhật người dùng.'
    toast.error(msg)
  }
  finally {
    editBusy.value = false
  }
}

async function handleDelete() {
  if (!deleteTarget.value) return
  deleteBusy.value = true
  try {
    await deleteUser(deleteTarget.value.user.id)
    toast.success('Đã xoá người dùng.')
    deleteTarget.value = null
  }
  catch (err: unknown) {
    const msg = (err as { data?: { error?: { message?: string } } })?.data?.error?.message ?? 'Không thể xoá người dùng.'
    toast.error(msg)
  }
  finally {
    deleteBusy.value = false
  }
}

// Assignment management -------------------------------------------------------
function assignedBuildingIds(row: ManagedUserWithAssignments): Set<string> {
  return new Set(row.assignments.map(a => a.building_id))
}

function availableBuildings(row: ManagedUserWithAssignments) {
  const assigned = assignedBuildingIds(row)
  return buildings.value.filter(b => !assigned.has(b.id))
}

function availableBuildingOptions(row: ManagedUserWithAssignments) {
  return [
    { value: '', label: 'Chọn tòa nhà…' },
    ...availableBuildings(row).map(b => ({ value: b.id, label: b.name })),
  ]
}

function roleLabel(role: ManagedUserWithAssignments['user']['role']): string {
  if (role === ROLES.OWNER) return 'Chủ nhà'
  if (role === ROLES.MANAGER) return 'Quản lý'
  return role ?? '—'
}

function canManageRow(row: ManagedUserWithAssignments): boolean {
  // Owners manage only managers; admins manage everyone shown.
  return authStore.isAdmin || row.user.role === ROLES.MANAGER
}

async function handleAssign(row: ManagedUserWithAssignments) {
  const buildingId = selectedBuildingByUser.value[row.user.id]
  if (!buildingId) return
  busyKey.value = `assign:${row.user.id}`
  try {
    await assign({ user_id: row.user.id, building_id: buildingId })
    selectedBuildingByUser.value[row.user.id] = ''
    toast.success('Đã gán vào tòa nhà.')
  }
  catch (err: unknown) {
    const msg = (err as { data?: { error?: { message?: string } } })?.data?.error?.message ?? 'Không thể gán.'
    toast.error(msg)
  }
  finally {
    busyKey.value = null
  }
}

async function handleToggle(assignmentId: string, nextValue: boolean) {
  busyKey.value = `toggle:${assignmentId}`
  try {
    await toggle(assignmentId, { can_delete_master_data: nextValue })
    toast.success('Đã cập nhật quyền xóa dữ liệu.')
  }
  catch {
    toast.error('Không thể cập nhật quyền xóa dữ liệu.')
  }
  finally {
    busyKey.value = null
  }
}

async function handleUnassign(assignmentId: string) {
  busyKey.value = `unassign:${assignmentId}`
  try {
    await unassign(assignmentId)
    toast.success('Đã bỏ gán khỏi tòa nhà.')
  }
  catch {
    toast.error('Không thể bỏ gán.')
  }
  finally {
    busyKey.value = null
  }
}

function managerInitials(row: ManagedUserWithAssignments): string {
  const name = row.user.name ?? row.user.email ?? ''
  return name.slice(0, 2).toUpperCase() || '??'
}
</script>

<template>
  <div class="space-y-6">
    <UiPageHeader
      title="Quản lý người dùng"
      :description="authStore.isAdmin
        ? 'Tạo owner/quản lý, phân quyền theo tòa nhà và quyền xóa dữ liệu nhạy cảm.'
        : 'Tạo quản lý và phân quyền theo tòa nhà trong phạm vi của bạn.'"
    />

    <!-- Create user -->
    <form
      class="space-y-4 rounded-lg border border-dark-border bg-dark-surface p-4"
      @submit.prevent="handleCreate"
    >
      <p class="text-sm font-semibold text-white">
        {{ authStore.canCreateOwner ? 'Tạo owner hoặc quản lý' : 'Tạo quản lý' }}
      </p>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <UiInput
          v-model="form.email"
          type="email"
          placeholder="Email"
          aria-label="Email"
          autocomplete="off"
        />
        <UiInput
          v-model="form.password"
          type="text"
          placeholder="Mật khẩu"
          aria-label="Mật khẩu"
          autocomplete="off"
        />
        <UiInput
          v-model="form.full_name"
          type="text"
          placeholder="Họ tên (tùy chọn)"
          aria-label="Họ tên"
        />
        <UiSelect
          v-model="form.role"
          :options="roleOptions"
          aria-label="Vai trò"
          :disabled="roleOptions.length === 1"
        />
      </div>

      <div v-if="buildings.length > 0">
        <p class="mb-1.5 text-xs text-muted">
          Tòa nhà (tùy chọn)
        </p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="b in buildings"
            :key="b.id"
            type="button"
            class="rounded-md border px-2.5 py-1 text-xs transition-colors"
            :class="form.building_ids.includes(b.id)
              ? 'border-cyan bg-cyan/15 text-cyan'
              : 'border-dark-border bg-dark-deep/40 text-muted hover:border-dark-border/80'"
            @click="toggleFormBuilding(b.id)"
          >
            {{ b.name }}
          </button>
        </div>
      </div>

      <div class="flex justify-end">
        <UiButton type="submit" :loading="createBusy">
          <IconPlus class="h-3.5 w-3.5" aria-hidden="true" />
          Tạo người dùng
        </UiButton>
      </div>
    </form>

    <!-- Buildings without manager alert -->
    <UiAlert
      v-if="buildingsWithoutManager.length > 0"
      severity="warning"
      :title="`${buildingsWithoutManager.length} tòa nhà chưa có manager`"
    >
      <div class="mt-2 flex flex-wrap gap-1.5">
        <span
          v-for="building in buildingsWithoutManager"
          :key="building.id"
          class="inline-flex items-center rounded-md border border-warning/30 bg-warning/5 px-2 py-0.5 text-xs text-warning"
        >
          {{ building.name }}
        </span>
      </div>
    </UiAlert>

    <!-- Loading -->
    <div v-if="isLoading" class="space-y-3">
      <UiSkeleton v-for="i in 3" :key="i" class="h-28 w-full rounded-lg" />
    </div>

    <!-- Empty state -->
    <UiEmptyState
      v-else-if="users.length === 0"
      title="Chưa có người dùng nào"
      description="Tạo owner hoặc quản lý để bắt đầu phân quyền tòa nhà."
    />

    <!-- User list -->
    <div v-else class="space-y-3">
      <div
        v-for="row in users"
        :key="row.user.id"
        class="rounded-lg border border-dark-border bg-dark-surface"
      >
        <!-- Card header -->
        <div class="flex flex-col gap-3 border-b border-dark-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex min-w-0 items-center gap-3">
            <!-- Avatar -->
            <span class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan/15 text-sm font-semibold text-cyan">
              {{ managerInitials(row) }}
            </span>
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold text-white">
                {{ row.user.name ?? row.user.email ?? row.user.id }}
              </p>
              <p v-if="row.user.name && row.user.email" class="truncate text-xs text-muted">
                {{ row.user.email }}
              </p>
            </div>
            <UiBadge
              :variant="row.user.role === 'owner' ? 'accent' : 'neutral'"
              class="ml-1 shrink-0"
            >
              {{ roleLabel(row.user.role) }}
            </UiBadge>
            <UiBadge
              v-if="row.assignments.length === 0"
              variant="warning"
              class="ml-1 shrink-0"
            >
              Chưa có tòa nhà
            </UiBadge>
            <span
              v-else
              class="ml-1 shrink-0 rounded-md border border-dark-border bg-dark-deep/40 px-2 py-0.5 text-xs font-medium text-muted"
            >
              {{ row.assignments.length }} tòa nhà
            </span>
          </div>

          <div
            v-if="canManageRow(row)"
            class="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center"
          >
            <!-- Assign form -->
            <form
              v-if="availableBuildings(row).length > 0"
              class="flex items-center gap-2"
              @submit.prevent="handleAssign(row)"
            >
              <UiSelect
                v-model="selectedBuildingByUser[row.user.id]"
                :options="availableBuildingOptions(row)"
                density="compact"
                aria-label="Chọn tòa nhà để gán"
                class="w-56"
              />
              <UiButton
                type="submit"
                size="sm"
                :loading="busyKey === `assign:${row.user.id}`"
                :disabled="!selectedBuildingByUser[row.user.id]"
              >
                <IconPlus class="h-3.5 w-3.5" aria-hidden="true" />
                Gán
              </UiButton>
            </form>
            <span v-else class="text-xs text-muted">
              Đã gán tất cả tòa nhà
            </span>

            <div class="flex items-center gap-1">
              <UiButton
                size="sm"
                variant="secondary"
                @click="startEdit(row)"
              >
                <IconPencilSquare class="h-3.5 w-3.5" aria-hidden="true" />
                Sửa
              </UiButton>
              <UiButton
                size="sm"
                variant="ghost"
                @click="deleteTarget = row"
              >
                <IconTrash class="h-3.5 w-3.5" aria-hidden="true" />
                Xoá
              </UiButton>
            </div>
          </div>
        </div>

        <!-- Assignments list -->
        <ul v-if="row.assignments.length > 0" class="divide-y divide-dark-border">
          <li
            v-for="assignment in row.assignments"
            :key="assignment.id"
            class="flex items-center gap-4 px-4 py-2.5"
          >
            <!-- Building info -->
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-white">
                {{ assignment.building?.name ?? assignment.building_id }}
              </p>
              <p v-if="assignment.building?.code" class="mt-0.5 font-mono text-xs text-muted">
                {{ assignment.building.code }}
              </p>
            </div>

            <!-- Delete permission toggle -->
            <label
              v-if="canManageRow(row)"
              class="flex shrink-0 items-center gap-2 rounded-md border border-dark-border/60 bg-dark-deep/30 px-2.5 py-1"
              :class="!busyKey && 'cursor-pointer hover:border-dark-border'"
            >
              <UiToggle
                :model-value="assignment.can_delete_master_data"
                size="sm"
                aria-label="Cho phép xóa dữ liệu"
                :disabled="busyKey === `toggle:${assignment.id}`"
                @update:model-value="handleToggle(assignment.id, $event)"
              />
              <span class="whitespace-nowrap text-xs text-muted">Cho xóa dữ liệu</span>
            </label>

            <!-- Unassign -->
            <UiButton
              v-if="canManageRow(row)"
              size="sm"
              variant="ghost"
              :loading="busyKey === `unassign:${assignment.id}`"
              @click="handleUnassign(assignment.id)"
            >
              <IconTrash class="h-3.5 w-3.5" aria-hidden="true" />
              <span class="sr-only sm:not-sr-only">Bỏ gán</span>
            </UiButton>
          </li>
        </ul>

        <!-- Empty assignments -->
        <div v-else class="flex items-center gap-2 px-4 py-3 text-xs text-muted">
          <IconAlertCircle class="h-4 w-4 shrink-0 text-warning/70" aria-hidden="true" />
          <span>Người dùng này chưa được gán tòa nhà nào.</span>
        </div>
      </div>
    </div>

    <UiModal
      :open="Boolean(editingRow)"
      title="Cập nhật người dùng"
      @close="closeEdit"
    >
      <form id="user-edit-form" class="space-y-4" @submit.prevent="handleUpdate">
        <div class="grid gap-3 sm:grid-cols-2">
          <UiInput
            v-model="editForm.email"
            type="email"
            placeholder="Email"
            aria-label="Email"
            autocomplete="off"
          />
          <UiInput
            v-model="editForm.password"
            type="text"
            placeholder="Mật khẩu mới"
            aria-label="Mật khẩu mới"
            autocomplete="off"
          />
          <UiInput
            v-model="editForm.full_name"
            type="text"
            placeholder="Họ tên"
            aria-label="Họ tên"
          />
          <UiSelect
            v-model="editForm.role"
            :options="roleOptions"
            aria-label="Vai trò"
            :disabled="!authStore.isAdmin || roleOptions.length === 1"
          />
        </div>
      </form>

      <template #footer>
        <UiButton variant="secondary" :disabled="editBusy" @click="closeEdit">
          Huỷ
        </UiButton>
        <UiButton :loading="editBusy" @click="handleUpdate">
          <IconCheckSmall class="h-3.5 w-3.5" aria-hidden="true" />
          Lưu
        </UiButton>
      </template>
    </UiModal>

    <UiConfirmModal
      :open="Boolean(deleteTarget)"
      title="Xoá người dùng"
      :message="deleteMessage"
      confirm-label="Xoá người dùng"
      :loading="deleteBusy"
      @cancel="deleteTarget = null"
      @confirm="handleDelete"
    />
  </div>
</template>
