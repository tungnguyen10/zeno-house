<script setup lang="ts">
import { getApiErrorMessage } from '~/utils/api-error'
import { getTenantOnboardingStage, type TenantOnboardingStage } from '~/utils/tenant-onboarding'

definePageMeta({ layout: 'auth', title: 'Hoàn tất tài khoản' })

const user = useSupabaseUser()
const {
  setOnboardingPassword,
  requestOnboardingEmail,
  confirmOnboardingEmail,
  linkGoogleIdentity,
  confirmGoogleIdentity,
} = useAuth()

const stage = ref<TenantOnboardingStage | null>(getTenantOnboardingStage(user.value))
const password = ref('')
const passwordConfirmation = ref('')
const email = ref(user.value?.email ?? '')
const loading = ref(false)
const errorMessage = ref<string | null>(null)
const emailSent = ref(false)

watch(user, (next) => {
  stage.value = getTenantOnboardingStage(next)
  if (next?.email) email.value = next.email
}, { deep: true })

async function setPassword() {
  if (password.value !== passwordConfirmation.value) {
    errorMessage.value = 'Mật khẩu xác nhận chưa khớp.'
    return
  }
  loading.value = true
  errorMessage.value = null
  try {
    await setOnboardingPassword(password.value)
    stage.value = 'email_required'
  }
  catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  }
  finally { loading.value = false }
}

async function sendEmailConfirmation() {
  loading.value = true
  errorMessage.value = null
  try {
    await requestOnboardingEmail(email.value.trim())
    emailSent.value = true
  }
  catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Không thể gửi email xác minh.')
  }
  finally { loading.value = false }
}

async function confirmEmail() {
  loading.value = true
  errorMessage.value = null
  try {
    await confirmOnboardingEmail()
    stage.value = 'google_required'
  }
  catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Email chưa được xác minh.')
  }
  finally { loading.value = false }
}

async function completeGoogle() {
  loading.value = true
  errorMessage.value = null
  try {
    await confirmGoogleIdentity()
    await navigateTo('/portal')
  }
  catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Hãy hoàn tất đăng nhập Google trước.')
  }
  finally { loading.value = false }
}
</script>

<template>
  <div class="space-y-6">
    <header>
      <p class="text-xs font-medium uppercase tracking-[0.16em] text-cyan">Thiết lập tài khoản</p>
      <h2 class="mt-2 text-2xl font-semibold text-white">Hoàn tất để vào portal</h2>
      <p class="mt-2 text-sm leading-6 text-muted">Bạn chỉ cần thực hiện một lần để bảo vệ tài khoản và liên kết Google.</p>
    </header>

    <form v-if="stage === 'password_required'" class="space-y-4 rounded-2xl border border-dark-border bg-dark-surface p-5 shadow-xl sm:p-6" @submit.prevent="setPassword">
      <AuthPasswordField v-model="password" label="Mật khẩu mới" autocomplete="new-password" :disabled="loading" required />
      <AuthPasswordField v-model="passwordConfirmation" label="Xác nhận mật khẩu" autocomplete="new-password" :disabled="loading" required />
      <UiAlert v-if="errorMessage" severity="danger">{{ errorMessage }}</UiAlert>
      <UiButton type="submit" class="w-full" :loading="loading">Tiếp tục</UiButton>
    </form>

    <section v-else-if="stage === 'email_required'" class="space-y-4 rounded-2xl border border-dark-border bg-dark-surface p-5 shadow-xl sm:p-6">
      <div>
        <h3 class="text-base font-semibold text-white">Xác minh email Google</h3>
        <p class="mt-1 text-sm leading-6 text-muted">Nhập đúng email Google bạn sẽ dùng để đăng nhập. Chúng tôi sẽ gửi liên kết xác minh đến email đó.</p>
      </div>
      <UiInput v-model="email" type="email" label="Email Google" autocomplete="email" :disabled="loading" required />
      <UiAlert v-if="emailSent" severity="info">Đã gửi liên kết. Mở email, bấm xác minh, rồi quay lại đây để tiếp tục.</UiAlert>
      <UiAlert v-if="errorMessage" severity="danger">{{ errorMessage }}</UiAlert>
      <div class="flex flex-col gap-2 sm:flex-row">
        <UiButton class="flex-1" :loading="loading" @click="sendEmailConfirmation">{{ emailSent ? 'Gửi lại liên kết' : 'Gửi liên kết xác minh' }}</UiButton>
        <UiButton class="flex-1" variant="secondary" :disabled="loading || !emailSent" @click="confirmEmail">Tôi đã xác minh</UiButton>
      </div>
    </section>

    <section v-else-if="stage === 'google_required'" class="space-y-4 rounded-2xl border border-dark-border bg-dark-surface p-5 shadow-xl sm:p-6">
      <div>
        <h3 class="text-base font-semibold text-white">Liên kết Google</h3>
        <p class="mt-1 text-sm leading-6 text-muted">Đăng nhập Google bằng email đã xác minh để hoàn tất. Google sẽ được gắn vào chính tài khoản portal này.</p>
      </div>
      <UiAlert v-if="errorMessage" severity="danger">{{ errorMessage }}</UiAlert>
      <UiButton class="w-full" variant="secondary" :loading="loading" @click="linkGoogleIdentity">
        <IconGoogle v-if="!loading" class="h-4 w-4" aria-hidden="true" />
        Liên kết tài khoản Google
      </UiButton>
      <UiButton class="w-full" :disabled="loading" @click="completeGoogle">Tôi đã hoàn tất với Google</UiButton>
    </section>

    <UiAlert v-else severity="danger">Không tìm thấy bước thiết lập tài khoản. Hãy đăng nhập lại hoặc liên hệ quản lý.</UiAlert>
  </div>
</template>
