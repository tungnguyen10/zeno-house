<script setup lang="ts">
const { logout } = useLogout();
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
    <!-- Simplified top header -->
    <header
      class="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 dark:border-gray-700 dark:bg-gray-900"
    >
      <span class="text-base font-bold text-gray-900 dark:text-white">
        Zeno House
      </span>

      <div class="flex items-center gap-2">
        <LayoutLanguageSwitcher />
        <UButton
          variant="ghost"
          color="neutral"
          size="sm"
          :aria-label="$t('navigation.user_menu.logout')"
          @click="logout"
        >
          <IconLogOut class="size-5" />
        </UButton>
      </div>
    </header>

    <!-- Page content with bottom nav spacing -->
    <main class="pb-20 md:pb-6 p-4 sm:p-6">
      <slot />
    </main>

    <!-- Bottom navigation bar -->
    <LayoutTenantBottomNav />
  </div>
</template>
