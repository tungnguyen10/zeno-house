<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <header class="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6">
      <span class="font-bold text-lg">Zeno House</span>
      <nav class="flex gap-4">
        <NuxtLink to="/tenant" class="hover:underline">{{ $t('nav.dashboard') }}</NuxtLink>
        <NuxtLink to="/tenant/room" class="hover:underline">{{ $t('nav.rooms') }}</NuxtLink>
        <NuxtLink to="/tenant/contracts" class="hover:underline">{{ $t('nav.contracts') }}</NuxtLink>
        <NuxtLink to="/tenant/invoices" class="hover:underline">{{ $t('nav.invoices') }}</NuxtLink>
      </nav>
      <UButton variant="ghost" @click="logout">{{ $t('auth.logout') }}</UButton>
    </header>
    <main class="p-6">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const supabase = useSupabaseClient()

async function logout() {
  await supabase.auth.signOut()
  await navigateTo('/login')
}
</script>
