<script setup lang="ts">
import { getApiErrorMessage } from '~/utils/api-error'

definePageMeta({ layout: 'auth', title: 'Hoàn tất tài khoản' })

const { setOnboardingPassword } = useAuth()
const password = ref('')
const passwordConfirmation = ref('')
const loading = ref(false)
const errorMessage = ref<string | null>(null)

async function setPassword() {
  if (password.value !== passwordConfirmation.value) {
    errorMessage.value = 'Mật khẩu xác nhận chưa khớp.'
    return
  }
  loading.value = true
  errorMessage.value = null
  try {
    await setOnboardingPassword(password.value)
    await navigateTo('/portal')
  }
  catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  }
  finally { loading.value = false }
}

</script>

<template>
  <div class="space-y-6">
    <header>
      <p class="text-xs font-medium uppercase tracking-[0.16em] text-cyan">Thiết lập tài khoản</p>
      <h2 class="mt-2 text-2xl font-semibold text-white">Đổi mật khẩu lần đầu</h2>
      <p class="mt-2 text-sm leading-6 text-muted">Tạo mật khẩu riêng để bảo vệ tài khoản trước khi vào portal.</p>
    </header>

    <form class="space-y-4 rounded-2xl border border-dark-border bg-dark-surface p-5 shadow-xl sm:p-6" @submit.prevent="setPassword">
      <AuthPasswordField v-model="password" label="Mật khẩu mới" autocomplete="new-password" :disabled="loading" required />
      <AuthPasswordField v-model="passwordConfirmation" label="Xác nhận mật khẩu" autocomplete="new-password" :disabled="loading" required />
      <UiAlert v-if="errorMessage" severity="danger">{{ errorMessage }}</UiAlert>
      <UiButton type="submit" class="w-full" :loading="loading">Đổi mật khẩu và vào portal</UiButton>
    </form>
  </div>
</template>
