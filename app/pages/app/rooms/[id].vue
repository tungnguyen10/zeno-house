<script setup lang="ts">
definePageMeta({ layout: "app", middleware: ["auth", "app-guard"] });

const { t } = useI18n();
const route = useRoute();
const id = route.params.id as string;

const { getRoom } = useRooms();
const room = ref(await getRoom(id));

if (!room.value) {
  await navigateTo("/app/rooms");
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(price);
}
</script>

<template>
  <div v-if="room" class="space-y-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <NuxtLink
          to="/app/rooms"
          class="mb-1 flex items-center gap-1 text-sm text-[--color-body] hover:text-[--color-title]"
        >
          <IconChevronLeft class="size-4" />
          {{ t("navigation.sidebar.rooms") }}
        </NuxtLink>
        <div class="flex items-center gap-3">
          <h1 class="text-2xl font-bold text-[--color-title]">
            {{ t("rooms.hero.room_label", { n: room.room_number }) }}
          </h1>
          <RoomStatusBadge :status="room.status" />
        </div>
        <p v-if="room.building" class="text-sm text-[--color-body]">{{ room.building.name }}</p>
      </div>
      <UButton variant="outline" color="neutral" :to="`/app/rooms/${id}/edit`">
        <IconPencilSquare class="size-4" />
        {{ t("actions.edit") }}
      </UButton>
    </div>

    <UCard>
      <dl class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt class="text-xs font-medium uppercase tracking-wide text-[--color-body]">
            {{ t("rooms.detail.floor") }}
          </dt>
          <dd class="mt-1 text-sm text-[--color-title]">
            {{ room.floor !== null ? t("rooms.hero.floor_label", { n: room.floor }) : "—" }}
          </dd>
        </div>
        <div>
          <dt class="text-xs font-medium uppercase tracking-wide text-[--color-body]">
            {{ t("rooms.detail.area") }}
          </dt>
          <dd class="mt-1 text-sm text-[--color-title]">
            {{ room.area !== null ? `${room.area} m²` : "—" }}
          </dd>
        </div>
        <div>
          <dt class="text-xs font-medium uppercase tracking-wide text-[--color-body]">
            {{ t("rooms.detail.base_price") }}
          </dt>
          <dd class="mt-1 text-sm font-medium text-[--color-title]">{{ formatPrice(room.base_price) }}</dd>
        </div>
        <div>
          <dt class="text-xs font-medium uppercase tracking-wide text-[--color-body]">
            {{ t("rooms.detail.deposit_amount") }}
          </dt>
          <dd class="mt-1 text-sm text-[--color-title]">{{ formatPrice(room.deposit_amount) }}</dd>
        </div>
        <div>
          <dt class="text-xs font-medium uppercase tracking-wide text-[--color-body]">
            {{ t("rooms.detail.max_occupants") }}
          </dt>
          <dd class="mt-1 text-sm text-[--color-title]">{{ room.max_occupants }}</dd>
        </div>
        <div v-if="room.current_tenant">
          <dt class="text-xs font-medium uppercase tracking-wide text-[--color-body]">
            {{ t("rooms.detail.current_tenant") }}
          </dt>
          <dd class="mt-1 text-sm text-[--color-title]">{{ room.current_tenant.full_name ?? "—" }}</dd>
        </div>
      </dl>

      <div v-if="room.description" class="mt-4 border-t border-[--color-border] pt-4">
        <dt class="mb-1 text-xs font-medium uppercase tracking-wide text-[--color-body]">
          {{ t("rooms.detail.description") }}
        </dt>
        <dd class="text-sm text-[--color-title]">{{ room.description }}</dd>
      </div>
    </UCard>
  </div>
</template>
