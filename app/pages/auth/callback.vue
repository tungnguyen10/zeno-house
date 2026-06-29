<script setup lang="ts">
definePageMeta({
  layout: 'auth',
})

// @nuxtjs/supabase plugin (enforce: "pre") auto-exchanges the PKCE code
// via detectSessionInUrl during client initialization. Manually calling
// exchangeCodeForSession would fail because the verifier is already consumed.
// Instead, just watch for the session to be populated via onAuthStateChange.
const user = useSupabaseUser()
const errorMessage = ref<string | null>(null)
let timeoutId: ReturnType<typeof setTimeout>

watch(user, async (newUser) => {
  if (newUser) {
    clearTimeout(timeoutId)
    await navigateTo('/')
  }
}, { immediate: true })

onMounted(() => {
  if (!user.value) {
    timeoutId = setTimeout(() => {
      if (!user.value) {
        errorMessage.value = 'Đăng nhập thất bại. Vui lòng thử lại.'
      }
    }, 8000)
  }
})

onUnmounted(() => {
  clearTimeout(timeoutId)
})
</script>

<template>
  <div class="rounded-2xl border border-dark-border bg-dark-surface p-6 text-center shadow-xl">
    <IconSpinner v-if="!errorMessage" class="mx-auto mb-4 h-6 w-6 animate-spin text-cyan" aria-hidden="true" />
    <IconAlertCircle v-else class="mx-auto mb-4 h-6 w-6 text-error" aria-hidden="true" />

    <p class="text-sm font-medium text-white">
      {{ errorMessage || 'Đang đăng nhập...' }}
    </p>

    <UiButton v-if="errorMessage" class="mt-5 w-full" variant="secondary" @click="navigateTo('/login')">
      Quay lại đăng nhập
    </UiButton>
  </div>
</template>
