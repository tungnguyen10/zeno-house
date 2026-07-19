<script setup lang="ts">
import { authPasswordResetSchema } from '~/utils/validators/access-requests'

definePageMeta({ layout: 'auth', title: 'Đặt lại mật khẩu' })
const { updatePassword, logout } = useAuth()
const form = reactive({ password: '', password_confirmation: '' })
const errors = ref<Record<string, string>>({})
const errorMessage = ref<string | null>(null)
const loading = ref(false)

async function submit() {
  errors.value = {}; errorMessage.value = null
  const result = authPasswordResetSchema.safeParse(form)
  if (!result.success) { for (const issue of result.error.issues) errors.value[String(issue.path[0])] = issue.message; return }
  loading.value = true
  try { await updatePassword(result.data.password); await logout() }
  catch { errorMessage.value = 'Liên kết đã hết hạn hoặc không hợp lệ. Hãy yêu cầu liên kết mới.' }
  finally { loading.value = false }
}
</script>

<template>
  <div>
    <div class="mb-7"><p class="text-xs font-medium uppercase tracking-[0.16em] text-cyan">Bảo mật tài khoản</p><h2 class="mt-2 text-2xl font-semibold text-white">Đặt mật khẩu mới</h2><p class="mt-2 text-sm leading-6 text-muted">Sử dụng ít nhất 8 ký tự.</p></div>
    <form class="space-y-4 rounded-2xl border border-dark-border bg-dark-surface p-5 shadow-xl sm:p-6" @submit.prevent="submit">
      <AuthPasswordField v-model="form.password" label="Mật khẩu mới" autocomplete="new-password" :error="errors.password" :disabled="loading" required />
      <AuthPasswordField v-model="form.password_confirmation" label="Xác nhận mật khẩu" autocomplete="new-password" :error="errors.password_confirmation" :disabled="loading" required />
      <UiAlert v-if="errorMessage" severity="danger">{{ errorMessage }}</UiAlert>
      <UiButton type="submit" class="w-full" :loading="loading">Lưu mật khẩu mới</UiButton>
    </form>
  </div>
</template>
