<script setup lang="ts">
import { authEmailSchema } from '~/utils/validators/access-requests'

definePageMeta({ layout: 'auth', title: 'Quên mật khẩu', middleware: 'guest' })
const { requestPasswordReset } = useAuth()
const email = ref('')
const error = ref<string>()
const sent = ref(false)
const loading = ref(false)

async function submit() {
  error.value = undefined
  const result = authEmailSchema.safeParse({ email: email.value })
  if (!result.success) { error.value = result.error.issues[0]?.message; return }
  loading.value = true
  try { await requestPasswordReset(result.data.email) }
  catch { /* Keep the same response to avoid account enumeration. */ }
  finally { loading.value = false; sent.value = true }
}
</script>

<template>
  <div>
    <div class="mb-7"><p class="text-xs font-medium uppercase tracking-[0.16em] text-cyan">Khôi phục truy cập</p><h2 class="mt-2 text-2xl font-semibold text-white">Quên mật khẩu?</h2><p class="mt-2 text-sm leading-6 text-muted">Nhập email để nhận liên kết đặt lại mật khẩu.</p></div>
    <div class="rounded-2xl border border-dark-border bg-dark-surface p-5 shadow-xl sm:p-6">
      <UiAlert v-if="sent" severity="success">Nếu tài khoản tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi.</UiAlert>
      <form v-else class="space-y-4" @submit.prevent="submit">
        <UiInput v-model="email" label="Email" type="email" autocomplete="email" :error="error" :disabled="loading" required />
        <UiButton type="submit" class="w-full" :loading="loading">Gửi liên kết</UiButton>
      </form>
    </div>
    <p class="mt-6 text-center"><NuxtLink to="/login" class="text-sm font-medium text-cyan">Quay lại đăng nhập</NuxtLink></p>
  </div>
</template>
