<script setup lang="ts">
import type { Room } from "~/types/rooms";

defineProps<{ room: Room }>();
const emit = defineEmits<{
  (e: "click", room: Room): void;
  (e: "edit", room: Room): void;
  (e: "delete", room: Room): void;
}>();

const { t } = useI18n();

const statusBg: Record<string, string> = {
  available: "bg-room-available",
  occupied: "bg-room-occupied",
  maintenance: "bg-room-maintenance",
  reserved: "bg-room-reserved",
};

function formatPrice(price: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(price);
}
</script>

<template>
  <div
    class="group relative cursor-pointer overflow-hidden rounded-xl border border-[--color-border] transition-all duration-200 hover:shadow-lg"
    role="button"
    :aria-label="`${t('rooms.quick_view')} ${room.room_number}`"
    tabindex="0"
    @click="emit('click', room)"
    @keydown.enter="emit('click', room)"
  >
    <!-- Status color strip -->
    <div :class="cn('h-2 w-full', statusBg[room.status])" />

    <div class="bg-[--color-bg-surface] p-4">
      <div class="mb-3 flex items-start justify-between gap-2">
        <div>
          <p class="text-lg font-bold text-[--color-title]">{{ room.room_number }}</p>
          <p v-if="room.building" class="text-xs text-[--color-body]">{{ room.building.name }}</p>
        </div>
        <RoomStatusBadge :status="room.status" />
      </div>

      <div class="space-y-1 text-sm text-[--color-body]">
        <p v-if="room.floor !== null">
          {{ t("rooms.detail.floor") }}: {{ room.floor }}
        </p>
        <p class="font-medium text-[--color-title]">{{ formatPrice(room.base_price) }}</p>
        <p v-if="room.current_tenant" class="truncate text-xs">
          {{ t("rooms.detail.current_tenant") }}: {{ room.current_tenant.full_name ?? "—" }}
        </p>
      </div>

      <!-- Actions (shown on hover) -->
      <div
        class="absolute right-2 top-4 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"
        @click.stop
      >
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          :aria-label="t('actions.edit')"
          @click="emit('edit', room)"
        >
          <IconPencilSquare class="size-3.5" />
        </UButton>
        <UButton
          size="xs"
          variant="ghost"
          color="error"
          :aria-label="t('actions.delete')"
          @click="emit('delete', room)"
        >
          <IconTrash class="size-3.5" />
        </UButton>
      </div>
    </div>
  </div>
</template>
