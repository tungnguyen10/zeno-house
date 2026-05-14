<script setup lang="ts">
definePageMeta({
  layout: 'auth',
  title: 'Đăng nhập',
  middleware: 'guest',
})

const { login } = useAuth()

const email = ref('')
const password = ref('')
const loading = ref(false)
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
</script>

<template>
  <div>
    <!-- Logo -->
    <div class="mb-8 text-center">
      <div class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-cyan mb-3">
        <span class="text-base font-bold text-dark-deep">Z</span>
      </div>
      <h1 class="text-xl font-semibold text-white">Zeno House</h1>
      <p class="mt-1 text-sm text-muted">Đăng nhập vào tài khoản của bạn</p>
    </div>

    <!-- Form -->
    <div class="rounded-2xl border border-dark-border bg-dark-surface p-6 shadow-xl">
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

        <p v-if="errorMessage" role="alert" class="text-sm text-error-vivid">
          {{ errorMessage }}
        </p>

        <UiButton type="submit" class="w-full" size="md" :loading="loading">
          Đăng nhập
        </UiButton>
      </form>
    </div>
  </div>
</template>
