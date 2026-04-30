<script setup lang="ts">
definePageMeta({ layout: "app", middleware: ["auth", "app-guard"] });

const { t } = useI18n();
const permissionsStore = usePermissionsStore();
const hasNoBuildings = computed(
  () => !permissionsStore.isAdmin && permissionsStore.loaded && permissionsStore.grants.length === 0,
);

const stats = computed(() => [
  {
    label: t("navigation.sidebar.occupancy"),
    value: "—",
    icon: "IconBuilding",
    variant: "default" as const,
  },
  {
    label: t("managers.dashboard.stat.active_tenants"),
    value: "—",
    icon: "IconUsers",
    variant: "default" as const,
  },
  {
    label: t("managers.dashboard.stat.open_maintenance"),
    value: "—",
    icon: "IconWrench",
    variant: "default" as const,
  },
  {
    label: t("managers.dashboard.stat.expiring_contracts"),
    value: "—",
    icon: "IconFileText",
    variant: "default" as const,
  },
]);
</script>

<template>
  <div class="space-y-6">
    <UIPageHeader
      :title="$t('navigation.sidebar.dashboard')"
      :description="$t('managers.dashboard.description')"
    />

    <UCard v-if="hasNoBuildings">
      <UIEmptyState
        icon="IconBuilding"
        :title="$t('managers.dashboard.noBuildings')"
        :description="$t('managers.dashboard.contactAdmin')"
      />
    </UCard>

    <template v-else>

    <UIAlertBanner
      v-if="false"
      message="5 hợp đồng sắp hết hạn trong 30 ngày"
      :action="{ label: 'Xem danh sách', to: '/app/contracts?expiring=true' }"
      variant="warning"
    />

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <UIStatCard
        v-for="stat in stats"
        :key="stat.label"
        :label="stat.label"
        :value="stat.value"
        :icon="stat.icon"
        :variant="stat.variant"
      />
    </div>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div class="lg:col-span-2">
        <UCard>
          <template #header>
            <p class="text-sm font-semibold text-[--color-title]">
              {{ $t("managers.dashboard.recent_activity.title") }}
            </p>
          </template>
          <UIEmptyState
            icon="IconBarChart"
            :title="$t('managers.dashboard.recent_activity.coming_soon')"
            :description="$t('managers.dashboard.recent_activity.description')"
          />
        </UCard>
      </div>

      <div>
        <UCard>
          <template #header>
            <p class="text-sm font-semibold text-[--color-title]">
              {{ $t("managers.dashboard.rooms_by_status.title") }}
            </p>
          </template>
          <UIEmptyState
            icon="IconDoorOpen"
            :title="$t('managers.dashboard.recent_activity.coming_soon')"
            :description="$t('managers.dashboard.rooms_by_status.description')"
          />
        </UCard>
      </div>
    </div>
    </template>
  </div>
</template>
