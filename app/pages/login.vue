<script setup lang="ts">
definePageMeta({
  layout: 'auth',
  title: 'Đăng nhập',
  middleware: 'guest',
})

const { login, loginWithGoogle } = useAuth()

const email = ref('')
const password = ref('')
const loading = ref(false)
const googleLoading = ref(false)
const errorMessage = ref<string | null>(null)

async function handleSubmit() {
  if (!email.value || !password.value) {
    errorMessage.value = 'Vui lòng nhập email và mật khẩu'
    return
  }

  loading.value = true
  errorMessage.value = null

  try {
    await login(email.value, password.value)
  }
  catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Đăng nhập thất bại'
    errorMessage.value = message
  }
  finally {
    loading.value = false
  }
}

async function handleGoogleLogin() {
  googleLoading.value = true
  errorMessage.value = null

  try {
    await loginWithGoogle()
  }
  catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Đăng nhập Google thất bại'
    errorMessage.value = message
    googleLoading.value = false
  }
}
</script>

<template>
  <div>
    <!-- Logo -->
    <div class="mb-8 flex flex-col items-center text-center">
      <IconLogo class="h-10 w-auto text-white mb-3" aria-label="Zeno House" />
      <p class="text-sm text-muted">Đăng nhập vào tài khoản của bạn</p>
    </div>

    <!-- Form -->
    <div class="rounded-2xl border border-dark-border bg-dark-surface p-6 shadow-xl">
      <UiButton
        class="w-full"
        variant="secondary"
        size="md"
        :loading="googleLoading"
        :disabled="loading"
        @click="handleGoogleLogin"
      >
        <IconGoogle v-if="!googleLoading" class="h-4 w-4 shrink-0" aria-hidden="true" />
        Đăng nhập với Google
      </UiButton>

      <div class="my-5 flex items-center gap-3">
        <div class="h-px flex-1 bg-dark-border" />
        <span class="text-xs text-muted">hoặc</span>
        <div class="h-px flex-1 bg-dark-border" />
      </div>

      <form class="space-y-4" @submit.prevent="handleSubmit">
        <UiInput
          v-model="email"
          label="Email"
          type="email"
          placeholder="you@example.com"
          autocomplete="email"
          :disabled="loading"
          required
        />
        <UiInput
          v-model="password"
          label="Mật khẩu"
          type="password"
          placeholder="••••••••"
          autocomplete="current-password"
          :disabled="loading"
          required
        />

        <UiAlert v-if="errorMessage" severity="danger" role="alert">
          {{ errorMessage }}
        </UiAlert>

        <UiButton type="submit" class="w-full" size="md" :loading="loading">
          Đăng nhập
        </UiButton>
      </form>
    </div>
  </div>
</template>
