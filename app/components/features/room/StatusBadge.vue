<script setup lang="ts">
import type { RoomStatus } from "~/types/rooms";

defineProps<{ status: RoomStatus }>();

const { t } = useI18n();

const colorMap: Record<RoomStatus, "success" | "primary" | "warning" | "secondary"> = {
  available: "success",
  occupied: "primary",
  maintenance: "warning",
  reserved: "secondary",
};
</script>

<template>
  <UBadge :color="colorMap[status]" variant="subtle">
    {{ t(`rooms.status.${status}`) }}
  </UBadge>
</template>
