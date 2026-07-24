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
    <AuthConsoleCard
      eyebrow="Khôi phục truy cập"
      title="Quên mật khẩu?"
      subtitle="Nhập email để nhận liên kết đặt lại mật khẩu."
      status="KHÔI PHỤC"
    >
      <UiAlert v-if="sent" severity="success">Nếu tài khoản tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi.</UiAlert>
      <form v-else class="space-y-4" @submit.prevent="submit">
        <UiInput v-model="email" label="Email" type="email" autocomplete="email" :error="error" :disabled="loading" required />
        <UiButton type="submit" class="w-full" :loading="loading">Gửi liên kết</UiButton>
      </form>
    </AuthConsoleCard>
    <p class="mt-6 text-center"><NuxtLink to="/login" class="text-sm font-medium text-cyan">Quay lại đăng nhập</NuxtLink></p>
  </div>
</template>
