<script setup lang="ts">
import type { Room } from "~/types/rooms";

defineProps<{ rooms: Room[]; loading?: boolean }>();
const emit = defineEmits<{
  (e: "click", room: Room): void;
  (e: "edit", room: Room): void;
  (e: "delete", room: Room): void;
}>();

const { t } = useI18n();
</script>

<template>
  <div>
    <div v-if="loading" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <USkeleton v-for="n in 8" :key="n" class="h-36 rounded-xl" />
    </div>

    <div
      v-else-if="rooms.length === 0"
      class="py-16 text-center text-[--color-body]"
    >
      {{ t("rooms.empty") }}
    </div>

    <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <RoomCard
        v-for="room in rooms"
        :key="room.id"
        :room="room"
        @click="emit('click', room)"
        @edit="emit('edit', room)"
        @delete="emit('delete', room)"
      />
    </div>
  </div>
</template>
