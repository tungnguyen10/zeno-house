<script setup lang="ts">
const { t } = useI18n();
const route = useRoute();
const authStore = useAuthStore();
const permissionsStore = usePermissionsStore();
const { role } = storeToRefs(authStore);

interface NavItem {
  label: string;
  icon: string;
  to: string;
  feature?: string;
  adminOnly?: boolean;
}

const allNavItems = computed<NavItem[]>(() => [
  { label: t("navigation.sidebar.dashboard"), icon: "IconDashboard", to: "/app" },
  { label: t("navigation.sidebar.buildings"), icon: "IconBuilding", to: "/app/buildings" },
  { label: t("navigation.sidebar.rooms"), icon: "IconDoorOpen", to: "/app/rooms", feature: "rooms" },
  { label: t("navigation.sidebar.tenants"), icon: "IconUsers", to: "/app/tenants", feature: "tenants" },
  { label: t("navigation.sidebar.contracts"), icon: "IconFileText", to: "/app/contracts", feature: "contracts" },
  { label: t("navigation.sidebar.invoices"), icon: "IconReceipt", to: "/app/invoices", feature: "invoices" },
  { label: t("navigation.sidebar.utilities"), icon: "IconZap", to: "/app/utilities", feature: "utilities" },
  { label: t("navigation.sidebar.expenses"), icon: "IconWallet", to: "/app/expenses" },
  { label: t("navigation.sidebar.maintenance"), icon: "IconWrench", to: "/app/maintenance" },
  { label: t("navigation.sidebar.reports"), icon: "IconBarChart", to: "/app/reports" },
  { label: t("navigation.sidebar.managers"), icon: "IconUserCog", to: "/app/managers", adminOnly: true },
  { label: t("navigation.sidebar.settings"), icon: "IconSettings", to: "/app/settings", adminOnly: true },
]);

const navItems = computed(() =>
  allNavItems.value.filter((item) => {
    if (item.adminOnly) return role.value === "admin";
    if (item.feature) return permissionsStore.hasAnyPermission(item.feature);
    return true;
  }),
);

function isActive(to: string) {
  if (to === "/app") return route.path === "/app";
  return route.path === to || route.path.startsWith(to + "/");
}
</script>

<template>
  <aside class="flex h-full w-64 flex-col border-r border-transparent bg-dark-nav">
    <div class="flex h-16 items-center px-6 border-b border-white/10">
      <span class="text-lg font-bold text-white">Zeno House</span>
    </div>

    <nav class="flex-1 overflow-y-auto py-4" aria-label="Sidebar navigation">
      <ul class="space-y-1 px-3">
        <li v-for="item in navItems" :key="item.to">
          <NuxtLink
            :to="item.to"
            :class="cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive(item.to)
                ? 'bg-white/15 text-white'
                : 'text-white/60 hover:text-white hover:bg-white/10',
            )"
            :aria-current="isActive(item.to) ? 'page' : undefined"
          >
            <component :is="item.icon" class="size-5 shrink-0" />
            {{ item.label }}
          </NuxtLink>
        </li>
      </ul>
    </nav>
  </aside>
</template>
