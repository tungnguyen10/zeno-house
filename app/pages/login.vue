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
    <div class="mb-7">
      <p class="text-xs font-medium uppercase tracking-[0.16em] text-cyan">Chào mừng trở lại</p>
      <h2 class="mt-2 text-2xl font-semibold text-white">Đăng nhập Zeno House</h2>
      <p class="mt-2 text-sm leading-6 text-muted">Tiếp tục công việc với tài khoản của bạn.</p>
    </div>

    <div class="rounded-2xl border border-dark-border bg-dark-surface p-5 shadow-xl sm:p-6">
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
        >
          <template #prefix><IconMail class="size-4" aria-hidden="true" /></template>
        </UiInput>
        <AuthPasswordField
          v-model="password"
          label="Mật khẩu"
          placeholder="••••••••"
          autocomplete="current-password"
          :disabled="loading"
          required
        />

        <div class="flex justify-end">
          <NuxtLink to="/forgot-password" class="text-xs font-medium text-cyan hover:text-cyan/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/40">
            Quên mật khẩu?
          </NuxtLink>
        </div>

        <UiAlert v-if="errorMessage" severity="danger" role="alert">
          {{ errorMessage }}
        </UiAlert>

        <UiButton type="submit" class="w-full" size="md" :loading="loading">
          Đăng nhập
        </UiButton>
      </form>
    </div>

    <p class="mt-6 text-center text-sm text-muted">
      Chưa có tài khoản?
      <NuxtLink to="/register" class="font-medium text-cyan hover:text-cyan/80">Đăng ký</NuxtLink>
    </p>
  </div>
</template>
