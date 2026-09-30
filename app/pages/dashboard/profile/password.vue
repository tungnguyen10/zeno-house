<script setup lang="ts">
import { userPasswordChangeSchema, type UserPasswordChangeInput } from '~/utils/validators/users'

const toast = useToast()
const { change, saving, fieldErrors: serverFieldErrors } = useUserPassword()

// Mobile large-title collapse: fades into the persistent app header once scrolled past.
const titleSentinel = ref<HTMLElement | null>(null)
const isTitleCollapsed = ref(false)
useIntersectionObserver(titleSentinel, ([entry]) => {
  isTitleCollapsed.value = !!entry && !entry.isIntersecting
})
const headerTitle = useAppHeaderTitle()
const compactTitle = computed(() => (isTitleCollapsed.value ? 'Đổi mật khẩu' : null))
watchEffect(() => {
  headerTitle.value = compactTitle.value
})
onBeforeUnmount(() => {
  // A newer page can claim this slot before this instance unmounts during a
  // page transition — only clear it if it's still ours.
  if (headerTitle.value === compactTitle.value) headerTitle.value = null
})

const form = reactive<UserPasswordChangeInput>({
  current_password: '',
  password: '',
  password_confirmation: '',
})
const touched = reactive<Partial<Record<keyof UserPasswordChangeInput, boolean>>>({})
const submitted = ref(false)

const validation = computed(() => userPasswordChangeSchema.safeParse(form))
const clientFieldErrors = computed<Record<string, string[]>>(() => (
  validation.value.success ? {} : validation.value.error.flatten().fieldErrors as Record<string, string[]>
))
const canSubmit = computed(() => validation.value.success && !saving.value)

function touchField(field: keyof UserPasswordChangeInput) {
  touched[field] = true
}

function visibleError(field: keyof UserPasswordChangeInput): string | undefined {
  if (!touched[field] && !submitted.value) return undefined
  return clientFieldErrors.value[field]?.[0] ?? serverFieldErrors.value[field]?.[0]
}

async function onSubmit() {
  submitted.value = true
  if (!validation.value.success) return

  const changed = await change(validation.value.data)
  if (!changed) return

  form.current_password = ''
  form.password = ''
  form.password_confirmation = ''
  toast.success('Đã đổi mật khẩu.')
  await navigateTo('/dashboard/profile')
}
</script>

<template>
  <div class="mx-auto w-full max-w-2xl space-y-6">
    <UiPageHeader
      title="Đổi mật khẩu"
      description="Xác nhận mật khẩu hiện tại trước khi tạo mật khẩu mới."
      :back-to="'/dashboard/profile'"
    >
      <div ref="titleSentinel" aria-hidden="true" />
    </UiPageHeader>

    <UiSurfacePanel>
      <form class="space-y-4" @submit.prevent="onSubmit">
        <UiInput
          v-model="form.current_password"
          type="password"
          label="Mật khẩu hiện tại"
          autocomplete="current-password"
          required
          :disabled="saving"
          :error="visibleError('current_password')"
          @blur="touchField('current_password')"
        />
        <UiInput
          v-model="form.password"
          type="password"
          label="Mật khẩu mới"
          autocomplete="new-password"
          required
          :disabled="saving"
          :error="visibleError('password')"
          @blur="touchField('password')"
        />
        <UiInput
          v-model="form.password_confirmation"
          type="password"
          label="Xác nhận mật khẩu mới"
          autocomplete="new-password"
          required
          :disabled="saving"
          :error="visibleError('password_confirmation')"
          @blur="touchField('password_confirmation')"
        />
        <UiButton type="submit" :loading="saving" :disabled="!canSubmit">
          Đổi mật khẩu
        </UiButton>
      </form>
    </UiSurfacePanel>
  </div>
</template>
