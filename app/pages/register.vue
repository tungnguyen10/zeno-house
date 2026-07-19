<script setup lang="ts">
import { authRegistrationSchema } from '~/utils/validators/access-requests'

definePageMeta({ layout: 'auth', title: 'Đăng ký', middleware: 'guest' })

const { register, loginWithGoogle } = useAuth()
const { public: publicConfig } = useRuntimeConfig()
const turnstileSiteKey = computed(() => String(publicConfig.turnstileSiteKey || ''))
const form = reactive({ full_name: '', email: '', password: '', password_confirmation: '' })
const errors = ref<Record<string, string>>({})
const errorMessage = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const loading = ref(false)
const googleLoading = ref(false)
const captchaToken = ref<string | null>(null)

async function handleSubmit() {
  errors.value = {}
  errorMessage.value = null
  const result = authRegistrationSchema.safeParse(form)
  if (!result.success) {
    for (const issue of result.error.issues) errors.value[String(issue.path[0])] = issue.message
    return
  }
  loading.value = true
  try {
    if (turnstileSiteKey.value && !captchaToken.value) {
      errorMessage.value = 'Hãy hoàn tất bước xác minh chống spam.'
      return
    }
    const outcome = await register(result.data, captchaToken.value ?? undefined)
    if (outcome.requiresEmailConfirmation) {
      successMessage.value = 'Nếu email hợp lệ, bạn sẽ nhận được liên kết xác minh. Sau đó tài khoản sẽ chờ admin phê duyệt.'
    }
  }
  catch {
    successMessage.value = 'Nếu email hợp lệ, bạn sẽ nhận được hướng dẫn tiếp theo.'
  }
  finally { loading.value = false }
}

async function handleGoogle() {
  googleLoading.value = true
  errorMessage.value = null
  try { await loginWithGoogle() }
  catch { errorMessage.value = 'Không thể tiếp tục với Google.'; googleLoading.value = false }
}
</script>

<template>
  <div>
    <div class="mb-7">
      <p class="text-xs font-medium uppercase tracking-[0.16em] text-cyan">Yêu cầu truy cập</p>
      <h2 class="mt-2 text-2xl font-semibold text-white">Tạo tài khoản</h2>
      <p class="mt-2 text-sm leading-6 text-muted">Tài khoản mới cần được admin phê duyệt trước khi sử dụng.</p>
    </div>
    <div class="rounded-2xl border border-dark-border bg-dark-surface p-5 shadow-xl sm:p-6">
      <UiButton class="w-full" variant="secondary" :loading="googleLoading" :disabled="loading" @click="handleGoogle">
        <IconGoogle v-if="!googleLoading" class="size-4" aria-hidden="true" />
        Tiếp tục với Google
      </UiButton>
      <div class="my-5 flex items-center gap-3"><span class="h-px flex-1 bg-dark-border" /><span class="text-xs text-muted">hoặc</span><span class="h-px flex-1 bg-dark-border" /></div>
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <UiInput v-model="form.full_name" label="Họ và tên" autocomplete="name" :error="errors.full_name" :disabled="loading" required />
        <UiInput v-model="form.email" label="Email" type="email" autocomplete="email" :error="errors.email" :disabled="loading" required />
        <AuthPasswordField v-model="form.password" label="Mật khẩu" autocomplete="new-password" :error="errors.password" :disabled="loading" required />
        <AuthPasswordField v-model="form.password_confirmation" label="Xác nhận mật khẩu" autocomplete="new-password" :error="errors.password_confirmation" :disabled="loading" required />
        <AuthTurnstile v-if="turnstileSiteKey" :site-key="turnstileSiteKey" @verified="captchaToken = $event" />
        <UiAlert v-if="errorMessage" severity="danger">{{ errorMessage }}</UiAlert>
        <UiAlert v-if="successMessage" severity="success">{{ successMessage }}</UiAlert>
        <UiButton type="submit" class="w-full" :loading="loading" :disabled="googleLoading || Boolean(turnstileSiteKey && !captchaToken)">Gửi yêu cầu đăng ký</UiButton>
      </form>
    </div>
    <p class="mt-6 text-center text-sm text-muted">Đã có tài khoản? <NuxtLink to="/login" class="font-medium text-cyan">Đăng nhập</NuxtLink></p>
  </div>
</template>
