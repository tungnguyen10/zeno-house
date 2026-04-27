<script setup lang="ts">
const { t } = useI18n();
const route = useRoute();

const navItems = computed(() => [
  { label: t("navigation.tenant_nav.home"), icon: "IconHome", to: "/tenant" },
  { label: t("navigation.tenant_nav.invoices"), icon: "IconReceipt", to: "/tenant/invoices" },
  { label: t("navigation.tenant_nav.maintenance"), icon: "IconWrench", to: "/tenant/maintenance" },
  { label: t("navigation.tenant_nav.notifications"), icon: "IconBell", to: "/tenant/notifications" },
  { label: t("navigation.tenant_nav.account"), icon: "IconUser", to: "/tenant/account" },
]);

function isActive(to: string) {
  if (to === "/tenant") return route.path === "/tenant";
  return route.path.startsWith(to);
}
</script>

<template>
  <nav
    class="fixed bottom-0 left-0 right-0 z-20 flex h-16 items-center justify-around border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 md:hidden"
    aria-label="Bottom navigation"
  >
    <NuxtLink
      v-for="item in navItems"
      :key="item.to"
      :to="item.to"
      :class="cn(
        'flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium transition-colors',
        isActive(item.to)
          ? 'text-primary-600 dark:text-primary-400'
          : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
      )"
      :aria-current="isActive(item.to) ? 'page' : undefined"
    >
      <component :is="item.icon" class="size-5" />
      <span>{{ item.label }}</span>
    </NuxtLink>
  </nav>
</template>
