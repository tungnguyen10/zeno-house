<script setup lang="ts">
import type { Role } from "~/types";

const { t } = useI18n();
const route = useRoute();
const authStore = useAuthStore();
const { role } = storeToRefs(authStore);

interface NavItem {
  label: string;
  icon: string;
  to: string;
  adminOnly?: boolean;
}

const base = computed(() => (role.value as Role) === "admin" ? "/admin" : "/manager");

const allNavItems = computed<NavItem[]>(() => [
  { label: t("navigation.sidebar.dashboard"), icon: "IconDashboard", to: base.value },
  { label: t("navigation.sidebar.buildings"), icon: "IconBuilding", to: `${base.value}/buildings` },
  { label: t("navigation.sidebar.rooms"), icon: "IconDoorOpen", to: `${base.value}/rooms` },
  { label: t("navigation.sidebar.tenants"), icon: "IconUsers", to: `${base.value}/tenants` },
  { label: t("navigation.sidebar.contracts"), icon: "IconFileText", to: `${base.value}/contracts` },
  { label: t("navigation.sidebar.invoices"), icon: "IconReceipt", to: `${base.value}/invoices` },
  { label: t("navigation.sidebar.utilities"), icon: "IconZap", to: `${base.value}/utilities` },
  { label: t("navigation.sidebar.expenses"), icon: "IconWallet", to: `${base.value}/expenses` },
  { label: t("navigation.sidebar.maintenance"), icon: "IconWrench", to: `${base.value}/maintenance` },
  { label: t("navigation.sidebar.reports"), icon: "IconBarChart", to: `${base.value}/reports` },
  { label: t("navigation.sidebar.settings"), icon: "IconSettings", to: `${base.value}/settings`, adminOnly: true },
]);

const navItems = computed(() =>
  allNavItems.value.filter(
    (item) => !item.adminOnly || (role.value as Role) === "admin",
  ),
);

function isActive(to: string) {
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
