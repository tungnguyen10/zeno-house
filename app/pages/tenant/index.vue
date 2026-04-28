<script setup lang="ts">
definePageMeta({ layout: "tenant", middleware: ["auth", "role"] });

// server:false — avoids SSR 404 when API doesn't exist yet; shows skeleton then empty state
// TODO: replace with useTenantPortal() composable when tenant-portal module ships
const { data: myRoom, pending: roomLoading } = useFetch("/api/tenant/me/room", {
  default: () => null,
  server: false,
});

const quickActions = [
  {
    label: "Hóa đơn",
    icon: "IconReceipt",
    to: "/tenant/invoices",
  },
  {
    label: "Thông báo",
    icon: "IconBell",
    to: "/tenant/notifications",
  },
  {
    label: "Tài khoản",
    icon: "IconUser",
    to: "/tenant/account",
  },
];
</script>

<template>
  <div class="space-y-4">
    <!-- Hero room card -->
    <TenantPortalRoomHero :room="myRoom" :loading="roomLoading" />

    <!-- Quick actions -->
    <div class="space-y-2">
      <p class="text-xs font-medium text-[--color-body]">Truy cập nhanh</p>
      <div class="flex gap-2">
        <NuxtLink
          v-for="item in quickActions"
          :key="item.to"
          :to="item.to"
          class="flex flex-1 flex-col items-center gap-2 rounded-xl bg-[--color-bg-surface] py-4 px-2 text-center ring-1 ring-[--color-border] transition-all active:scale-95"
        >
          <component :is="item.icon" class="size-5 text-[--color-theme]" />
          <span class="text-xs font-medium text-[--color-title] leading-tight">
            {{ item.label }}
          </span>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
