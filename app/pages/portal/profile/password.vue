<script setup lang="ts">
import type { TenantPasswordChangeInput } from '~/utils/validators/tenant-portal'
import { tenantPasswordChangeSchema } from '~/utils/validators/tenant-portal'

definePageMeta({
  layout: 'tenant',
  pageTransition: { name: 'portal-page', mode: 'out-in' },
})

const { setChrome } = usePortalChrome()
setChrome({ title: 'Đổi mật khẩu', back: '/portal/profile' })

const toast = usePortalToast()
const {
  change,
  saving,
  fieldErrors: serverFieldErrors,
  apiError,
} = usePortalPassword()

const form = reactive<TenantPasswordChangeInput>({
  current_password: '',
  password: '',
  password_confirmation: '',
})
const touched = reactive<Partial<Record<keyof TenantPasswordChangeInput, boolean>>>({})
const submitted = ref(false)

const validation = computed(() => tenantPasswordChangeSchema.safeParse(form))
const clientFieldErrors = computed<Record<string, string[]>>(() => (
  validation.value.success
    ? {}
    : validation.value.error.flatten().fieldErrors as Record<string, string[]>
))
const canSubmit = computed(() => validation.value.success && !saving.value)

function touchField(field: keyof TenantPasswordChangeInput) {
  touched[field] = true
}

function visibleError(field: keyof TenantPasswordChangeInput): string | undefined {
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
  await navigateTo('/portal/profile')
}
</script>

<template>
  <div class="mx-auto w-full max-w-2xl px-4 py-5 lg:px-8 lg:py-8">
    <form class="space-y-5" @submit.prevent="onSubmit">
      <PortalCard class="space-y-4">
        <div class="flex items-start gap-3">
          <span
            class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-smoke-blue text-theme"
            aria-hidden="true"
          >
            <IconLock class="h-5 w-5" />
          </span>
          <div class="min-w-0">
            <h1 class="portal-type-heading text-title">
              Bảo vệ tài khoản
            </h1>
            <p class="mt-1 portal-type-caption text-body">
              Xác nhận mật khẩu hiện tại trước khi tạo mật khẩu mới.
            </p>
          </div>
        </div>

        <PortalInput
          v-model="form.current_password"
          label="Mật khẩu hiện tại"
          type="password"
          revealable
          autocomplete="current-password"
          required
          :disabled="saving"
          :error="visibleError('current_password')"
          @blur="touchField('current_password')"
        />

        <div class="border-t border-border-light pt-4">
          <PortalInput
            v-model="form.password"
            label="Mật khẩu mới"
            type="password"
            revealable
            autocomplete="new-password"
            required
            hint="Từ 8 đến 72 ký tự và khác mật khẩu hiện tại."
            :disabled="saving"
            :error="visibleError('password')"
            @blur="touchField('password')"
          />

          <PortalInput
            v-model="form.password_confirmation"
            class="mt-1"
            label="Xác nhận mật khẩu mới"
            type="password"
            revealable
            autocomplete="new-password"
            required
            :disabled="saving"
            :error="visibleError('password_confirmation')"
            @blur="touchField('password_confirmation')"
          />
        </div>
      </PortalCard>

      <p
        v-if="apiError"
        role="alert"
        class="rounded-xl border border-portal-danger/25 bg-portal-danger/5 px-4 py-3 portal-type-body text-portal-danger"
      >
        {{ apiError }}
      </p>

      <PortalButton
        type="submit"
        block
        :loading="saving"
        :disabled="!canSubmit"
      >
        Đổi mật khẩu
      </PortalButton>
    </form>
  </div>
</template>
