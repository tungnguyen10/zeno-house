<script setup lang="ts">
definePageMeta({ layout: "admin", middleware: ["auth", "role"] });

const { t } = useI18n();

// TODO: replace with real API calls when buildings/rooms/maintenance modules ship
const stats = [
  {
    label: t("navigation.sidebar.occupancy") || "Tỷ lệ lấp đầy",
    value: "—",
    icon: "IconBuilding",
    variant: "default" as const,
  },
  {
    label: "Thuê nhân đang ở",
    value: "—",
    icon: "IconUsers",
    variant: "default" as const,
  },
  {
    label: "Bảo trì đang mở",
    value: "—",
    icon: "IconWrench",
    variant: "default" as const,
  },
  {
    label: "HĐ hết hạn (30 ngày)",
    value: "—",
    icon: "IconFileText",
    variant: "default" as const,
  },
];
</script>

<template>
  <div class="space-y-6">
    <UIPageHeader
      :title="$t('navigation.sidebar.dashboard')"
      description="Tổng quan hoạt động hôm nay"
    />

    <!-- Alert zone: hidden when no alerts, shown when issues exist -->
    <!-- TODO: replace false with real alert condition when contracts module ships -->
    <UIAlertBanner
      v-if="false"
      message="5 hợp đồng sắp hết hạn trong 30 ngày"
      :action="{ label: 'Xem danh sách', to: '/admin/contracts?expiring=true' }"
      variant="warning"
    />

    <!-- KPI cards -->
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

    <!-- Activity feed placeholder -->
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div class="lg:col-span-2">
        <UCard>
          <template #header>
            <p class="text-sm font-semibold text-[--color-title]">
              Hoạt động gần đây
            </p>
          </template>
          <UIEmptyState
            icon="IconBarChart"
            title="Sắp có"
            description="Nhật ký hoạt động sẽ hiển thị ở đây sau khi các module được kích hoạt"
          />
        </UCard>
      </div>

      <div>
        <UCard>
          <template #header>
            <p class="text-sm font-semibold text-[--color-title]">
              Phòng theo trạng thái
            </p>
          </template>
          <UIEmptyState
            icon="IconDoorOpen"
            title="Sắp có"
            description="Biểu đồ chiếm phòng sẽ hiển thị sau khi module phòng được kích hoạt"
          />
        </UCard>
      </div>
    </div>
  </div>
</template>
