<script setup lang="ts">
import type { CreatableRole } from '~/utils/constants/roles'
import { userCreateSchema, type UserCreateInput } from '~/utils/validators/users'

const props = defineProps<{
  open: boolean
  buildings: { id: string; name: string }[]
  roleOptions: { value: CreatableRole; label: string }[]
  defaultRole: CreatableRole
  busy: boolean
  error?: string | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', payload: UserCreateInput): void
}>()

const form = reactive({ email: '', password: '', full_name: '', role: props.defaultRole, building_ids: [] as string[] })
const fieldErrors = ref<Record<string, string[]>>({})

watch(() => props.open, (open) => {
  if (!open) return
  Object.assign(form, { email: '', password: '', full_name: '', role: props.defaultRole, building_ids: [] })
  fieldErrors.value = {}
})

function toggleBuilding(id: string) {
  form.building_ids = form.building_ids.includes(id)
    ? form.building_ids.filter(value => value !== id)
    : [...form.building_ids, id]
}

function submit() {
  const parsed = userCreateSchema.safeParse({ ...form, full_name: form.full_name.trim() || undefined })
  if (!parsed.success) {
    fieldErrors.value = parsed.error.flatten().fieldErrors as Record<string, string[]>
    return
  }
  fieldErrors.value = {}
  emit('submit', parsed.data)
}
</script>

<template>
  <UiModal :open="open" title="Thêm người dùng" size="md" @close="emit('close')">
    <form id="user-create-form" class="space-y-4" novalidate @submit.prevent="submit">
      <div class="grid gap-3 sm:grid-cols-2">
        <UiInput v-model="form.email" label="Email" type="email" autocomplete="off" required :error="fieldErrors.email?.[0]" />
        <UiInput v-model="form.password" label="Mật khẩu" type="password" autocomplete="new-password" required :error="fieldErrors.password?.[0]" />
        <UiInput v-model="form.full_name" label="Họ tên (tuỳ chọn)" :error="fieldErrors.full_name?.[0]" />
        <UiSelect v-model="form.role" label="Vai trò" :options="roleOptions" :disabled="roleOptions.length === 1" />
      </div>
      <fieldset v-if="buildings.length > 0">
        <legend class="mb-1.5 text-sm font-medium text-ui-muted">Tòa nhà phụ trách (tuỳ chọn)</legend>
        <div class="max-h-48 overflow-y-auto rounded-xl border border-ui-border bg-ui-surface p-3 sm:space-y-2">
          <div v-for="building in buildings" :key="building.id" class="flex min-h-11 items-center sm:min-h-0">
            <UiCheckbox
              :model-value="form.building_ids.includes(building.id)"
              :label="building.name"
              @update:model-value="toggleBuilding(building.id)"
            />
          </div>
        </div>
      </fieldset>
      <UiAlert v-if="error" severity="danger">{{ error }}</UiAlert>
      <p class="text-xs text-ui-muted">Sau khi tạo, hãy gửi email và mật khẩu cho người dùng.</p>
    </form>
    <template #footer>
      <UiButton class="min-h-11 sm:min-h-0" variant="secondary" :disabled="busy" @click="emit('close')">Huỷ</UiButton>
      <UiButton type="submit" class="min-h-11 sm:min-h-0" form="user-create-form" :loading="busy">
        <IconPlus class="h-3.5 w-3.5" aria-hidden="true" />
        Thêm người dùng
      </UiButton>
    </template>
  </UiModal>
</template>
