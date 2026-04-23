<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
    <UCard class="w-full max-w-sm">
      <template #header>
        <h1 class="text-xl font-bold text-center">Zeno House</h1>
        <p class="text-sm text-center text-gray-500 mt-1">{{ $t('auth.login') }}</p>
      </template>

      <UForm :schema="schema" :state="form" class="space-y-4" @submit="onSubmit">
        <UFormField :label="$t('auth.email')" name="email">
          <UInput v-model="form.email" type="email" autocomplete="email" class="w-full" />
        </UFormField>

        <UFormField :label="$t('auth.password')" name="password">
          <UInput v-model="form.password" type="password" autocomplete="current-password" class="w-full" />
        </UFormField>

        <UAlert v-if="error" color="error" :description="error" />

        <UButton type="submit" class="w-full justify-center" :loading="loading">
          {{ $t('auth.login') }}
        </UButton>
      </UForm>

      <template #footer>
        <NuxtLink to="/forgot-password" class="text-sm text-center block text-primary hover:underline">
          {{ $t('auth.forgot_password') }}
        </NuxtLink>
      </template>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { z } from 'zod'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: false })

const supabase = useSupabaseClient()
const authStore = useAuthStore()

const form = reactive({ email: '', password: '' })
const loading = ref(false)
const error = ref('')

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

async function onSubmit() {
  loading.value = true
  error.value = ''
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: form.email,
    password: form.password,
  })
  if (authError) {
    error.value = authError.message
    loading.value = false
    return
  }
  authStore.clearRole()
  const role = await authStore.fetchRole()
  if (role === 'admin') await navigateTo('/admin')
  else if (role === 'manager') await navigateTo('/manager')
  else await navigateTo('/tenant')
  loading.value = false
}
</script>
