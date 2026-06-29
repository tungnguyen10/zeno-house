<script setup lang="ts">
definePageMeta({
  layout: 'auth',
})

const route = useRoute()
const supabase = useSupabaseClient()
const errorMessage = ref<string | null>(null)

onMounted(async () => {
  const code = typeof route.query.code === 'string' ? route.query.code : null

  if (!code) {
    errorMessage.value = 'Không tìm thấy mã xác thực từ Google'
    return
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    errorMessage.value = error.message
    return
  }

  await navigateTo('/')
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
