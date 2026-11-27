<script setup lang="ts">
import type { ManagedUserWithAssignments } from '~/types/users'
import { ROLES, type CreatableRole } from '~/utils/constants/roles'
import { userUpdateSchema, type UserUpdateInput } from '~/utils/validators/users'
import { managedRoleLabel, userInitials } from '~/utils/users/display'

const props = defineProps<{
  row: ManagedUserWithAssignments | null
  buildings: { id: string; name: string }[]
  roleOptions: { value: CreatableRole; label: string }[]
  canEditRole: boolean
  busyKeys: ReadonlySet<string>
}>()

const editing = defineModel<boolean>('editing', { default: false })

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'update', id: string, payload: UserUpdateInput): void
  (e: 'assign', userId: string, buildingId: string): void
  (e: 'toggleDelete', assignmentId: string, value: boolean): void
  (e: 'unassign' | 'remove', id: string): void
}>()

const form = reactive({ email: '', password: '', full_name: '', role: ROLES.MANAGER as CreatableRole })
const formError = ref<string | null>(null)
const buildingToAssign = ref('')
const confirmingDelete = ref(false)
const cancelDeleteRef = ref<{ $el?: HTMLElement } | null>(null)
const infoSection = ref<HTMLElement | null>(null)
const dangerSection = ref<HTMLElement | null>(null)

// Keep the last row so the leave animation doesn't show an empty sheet.
const displayRow = shallowRef(props.row)
watch(() => props.row, (value) => {
  if (value) displayRow.value = value
}, { flush: 'sync' })

const displayName = computed(() => displayRow.value?.user.name ?? displayRow.value?.user.email ?? '')
const initials = computed(() => (displayRow.value ? userInitials(displayRow.value.user.name, displayRow.value.user.email) : ''))
const availableOptions = computed(() => {
  const assigned = new Set(displayRow.value?.assignments.map(a => a.building_id))
  return [
    { value: '', label: 'Chọn tòa nhà…' },
    ...props.buildings.filter(b => !assigned.has(b.id)).map(b => ({ value: b.id, label: b.name })),
  ]
})
const isBusy = (key: string) => props.busyKeys.has(key)
const subtitle = computed(() => {
  const user = displayRow.value?.user
  if (!user) return ''
  const role = managedRoleLabel(user.role)
  return user.name ? `${user.email} · ${role}` : role
})

watch(() => props.row?.user.id, () => {
  editing.value = false
  confirmingDelete.value = false
  buildingToAssign.value = ''
  formError.value = null
})
watch(() => props.row?.assignments.length, () => { buildingToAssign.value = '' })

// Swapping a control for its form drops focus to <body>, which would also kill Escape-to-close.
// While closing, leave focus to the drawer's own restore.
watch(editing, async (value) => {
  if (!props.row) return
  await nextTick()
  infoSection.value?.querySelector<HTMLElement>(value ? 'input' : 'button')?.focus()
})

function startEdit() {
  if (!props.row) return
  form.email = props.row.user.email ?? ''
  form.password = ''
  form.full_name = props.row.user.name ?? ''
  form.role = props.row.user.role === ROLES.OWNER ? ROLES.OWNER : ROLES.MANAGER
  formError.value = null
  editing.value = true
}

function submitEdit() {
  if (!props.row) return
  const payload: UserUpdateInput = { email: form.email, full_name: form.full_name }
  if (form.password) payload.password = form.password
  if (props.canEditRole) payload.role = form.role
  const parsed = userUpdateSchema.safeParse(payload)
  if (!parsed.success) {
    formError.value = parsed.error.issues[0]?.message ?? 'Thông tin chưa hợp lệ.'
    return
  }
  formError.value = null
  emit('update', props.row.user.id, parsed.data)
}

async function cancelDelete() {
  confirmingDelete.value = false
  await nextTick()
  dangerSection.value?.querySelector<HTMLElement>('button')?.focus()
}

async function askDelete() {
  confirmingDelete.value = true
  await nextTick()
  cancelDeleteRef.value?.$el?.focus()
}
</script>

<template>
  <UiDrawer
    :model-value="row !== null"
    :title="displayName"
    width="lg:w-[26rem]"
    @update:model-value="!$event && emit('close')"
  >
    <template #header>
      <div v-if="displayRow" class="flex min-w-0 items-center gap-3">
        <span class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ui-accent/15 text-sm font-semibold text-ui-accent" aria-hidden="true">{{ initials }}</span>
        <div class="min-w-0">
          <h2 class="truncate text-base font-semibold text-ui-primary">{{ displayName }}</h2>
          <p class="truncate text-xs text-ui-muted">{{ subtitle }}</p>
        </div>
      </div>
    </template>

    <div v-if="displayRow" class="space-y-6">
      <section ref="infoSection" aria-labelledby="user-info-heading">
        <div class="flex items-center justify-between gap-3" :class="editing && 'mb-3'">
          <div class="min-w-0">
            <h3 id="user-info-heading" class="text-xs font-semibold uppercase tracking-wide text-ui-muted">Thông tin đăng nhập</h3>
            <p v-if="!editing" class="mt-1 text-xs text-ui-muted">Email, họ tên và mật khẩu</p>
          </div>
          <UiButton v-if="!editing" class="min-h-11 shrink-0 sm:min-h-0" size="sm" variant="secondary" @click="startEdit">Sửa</UiButton>
        </div>
        <form v-if="editing" class="space-y-3" novalidate @submit.prevent="submitEdit">
          <UiInput v-model="form.email" label="Email" type="email" autocomplete="off" />
          <UiInput v-model="form.full_name" label="Họ tên" />
          <UiInput v-model="form.password" label="Mật khẩu mới" type="password" autocomplete="new-password" hint="Để trống nếu không đổi" />
          <UiSelect v-if="canEditRole" v-model="form.role" label="Vai trò" :options="roleOptions" />
          <UiAlert v-if="formError" severity="danger">{{ formError }}</UiAlert>
          <div class="flex justify-end gap-2">
            <UiButton class="min-h-11 sm:min-h-0" variant="secondary" :disabled="isBusy(`update:${displayRow.user.id}`)" @click="editing = false">Huỷ</UiButton>
            <UiButton type="submit" class="min-h-11 sm:min-h-0" :loading="isBusy(`update:${displayRow.user.id}`)">Lưu</UiButton>
          </div>
        </form>
      </section>

      <section aria-labelledby="user-buildings-heading">
        <h3 id="user-buildings-heading" class="mb-2 text-xs font-semibold uppercase tracking-wide text-ui-muted">Tòa nhà phụ trách</h3>
        <p v-if="displayRow.assignments.length === 0" class="py-2 text-sm text-ui-muted">Chưa được gán tòa nhà nào.</p>
        <ul v-else role="list" class="divide-y divide-ui-border">
          <li v-for="assignment in displayRow.assignments" :key="assignment.id" class="py-3">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-ui-primary">{{ assignment.building?.name ?? assignment.building_id }}</p>
                <p v-if="assignment.building?.code" class="truncate font-mono text-xs text-ui-muted">{{ assignment.building.code }}</p>
              </div>
              <UiButton class="min-h-11 shrink-0 hover:!text-status-danger sm:min-h-0" size="sm" variant="ghost" :loading="isBusy(`unassign:${assignment.id}`)" @click="emit('unassign', assignment.id)">Bỏ gán</UiButton>
            </div>
            <UiToggle
              class="mt-1 min-h-11 sm:min-h-0"
              label="Cho phép xoá dữ liệu"
              :model-value="assignment.can_delete_master_data"
              size="sm"
              :aria-label="`Cho phép xoá dữ liệu ở ${assignment.building?.name ?? 'tòa nhà này'}`"
              :disabled="isBusy(`toggle:${assignment.id}`)"
              @update:model-value="emit('toggleDelete', assignment.id, $event)"
            />
          </li>
        </ul>
        <form
          v-if="availableOptions.length > 1"
          data-assign-form
          class="mt-2 flex items-center gap-2"
          @submit.prevent="buildingToAssign && emit('assign', displayRow.user.id, buildingToAssign)"
        >
          <UiSelect v-model="buildingToAssign" :options="availableOptions" aria-label="Chọn tòa nhà để gán" class="min-w-0 flex-1" />
          <UiButton type="submit" class="min-h-11 sm:min-h-10" :disabled="!buildingToAssign" :loading="isBusy(`assign:${displayRow.user.id}`)">Gán</UiButton>
        </form>
        <p v-else class="mt-2 text-xs text-ui-muted">Đã gán tất cả tòa nhà.</p>
      </section>

      <section ref="dangerSection" aria-labelledby="user-danger-heading" class="rounded-lg border border-status-danger/25 p-3">
        <h3 id="user-danger-heading" class="text-xs font-semibold uppercase tracking-wide text-status-danger">Vùng nguy hiểm</h3>
        <div v-if="!confirmingDelete" class="mt-2 flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-medium text-ui-primary">Xoá người dùng</p>
            <p class="text-xs text-ui-muted">Thu hồi quyền đăng nhập. Không thể hoàn tác.</p>
          </div>
          <UiButton
            class="min-h-11 shrink-0 !border-status-danger/40 !text-status-danger hover:!bg-status-danger/10 sm:min-h-0"
            size="sm"
            variant="secondary"
            aria-label="Xoá người dùng"
            @click="askDelete"
          >Xoá</UiButton>
        </div>
        <div v-else class="mt-2 space-y-2">
          <p class="text-sm text-ui-primary">Xoá {{ displayName }} khỏi hệ thống? Hành động này sẽ thu hồi quyền đăng nhập của tài khoản và không thể hoàn tác.</p>
          <div class="flex justify-end gap-2">
            <UiButton ref="cancelDeleteRef" class="min-h-11 sm:min-h-0" size="sm" variant="secondary" :disabled="isBusy(`delete:${displayRow.user.id}`)" @click="cancelDelete">Huỷ</UiButton>
            <UiButton class="min-h-11 sm:min-h-0" size="sm" variant="danger" :loading="isBusy(`delete:${displayRow.user.id}`)" @click="emit('remove', displayRow.user.id)">Xoá vĩnh viễn</UiButton>
          </div>
        </div>
      </section>
    </div>
  </UiDrawer>
</template>
