<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <aside class="fixed inset-y-0 left-0 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
      <div class="p-4 font-bold text-lg border-b border-gray-200 dark:border-gray-700">
        Zeno House
      </div>
      <nav class="p-4 space-y-1">
        <NuxtLink to="/manager" class="block px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
          {{ $t('nav.dashboard') }}
        </NuxtLink>
        <NuxtLink to="/manager/rooms" class="block px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
          {{ $t('nav.rooms') }}
        </NuxtLink>
        <NuxtLink to="/manager/tenants" class="block px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
          {{ $t('nav.tenants') }}
        </NuxtLink>
        <NuxtLink to="/manager/contracts" class="block px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
          {{ $t('nav.contracts') }}
        </NuxtLink>
        <NuxtLink to="/manager/invoices" class="block px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
          {{ $t('nav.invoices') }}
        </NuxtLink>
      </nav>
    </aside>
    <div class="pl-64">
      <header class="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-end px-6">
        <UButton variant="ghost" @click="logout">{{ $t('auth.logout') }}</UButton>
      </header>
      <main class="p-6">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
const supabase = useSupabaseClient()

async function logout() {
  await supabase.auth.signOut()
  await navigateTo('/login')
}
</script>
