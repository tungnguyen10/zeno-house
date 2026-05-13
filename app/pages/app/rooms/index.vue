<script setup lang="ts">
import type { Room } from "~/types/rooms";
import type { Building } from "~/types/buildings";

definePageMeta({ layout: "app", middleware: ["auth", "app-guard"] });

const { t } = useI18n();
const route = useRoute();
const toast = useToast();

const { filteredRooms, rooms, loading, filters, stats, fetchRooms, deleteRoom, getRoom } = useRooms();
const { buildings, fetchBuildings } = useBuildings();

// Sync URL query params → filters
filters.building_id = (route.query.building_id as string) ?? "";
filters.status = (route.query.status as string) ?? "";
filters.floor = (route.query.floor as string) ?? "";
filters.search = (route.query.search as string) ?? "";

await Promise.all([
  fetchRooms(),
  fetchBuildings(),
]);

// Quick-view modal
const selectedRoom = ref<Room | null>(null);
const showQuickView = ref(false);
const quickViewRoom = ref<Room | null>(null);
const quickViewLoading = ref(false);

async function openQuickView(room: Room) {
  selectedRoom.value = room;
  showQuickView.value = true;
  quickViewLoading.value = true;
  quickViewRoom.value = await getRoom(room.id);
  quickViewLoading.value = false;
}

// Delete
const deleteTarget = ref<Room | null>(null);
const showDeleteModal = ref(false);
const deleting = ref(false);

function openDelete(room: Room) {
  deleteTarget.value = room;
  showDeleteModal.value = true;
}

async function confirmDelete() {
  if (!deleteTarget.value) return;
  deleting.value = true;
  try {
    await deleteRoom(deleteTarget.value.id);
    toast.add({ title: t("common.success"), color: "success" });
    showDeleteModal.value = false;
    await fetchRooms();
  } catch (err: unknown) {
    const msg = (err as { data?: { message?: string } })?.data?.message;
    toast.add({
      title: msg === "rooms.delete_blocked" ? t("rooms.delete_blocked") : t("common.error"),
      color: "error",
    });
  } finally {
    deleting.value = false;
  }
}

// Filters → URL sync
async function onFiltersChange(f: { building_id: string; status: string; floor: string; search: string }) {
  filters.building_id = f.building_id;
  filters.status = f.status;
  filters.floor = f.floor;
  filters.search = f.search;

  await navigateTo({
    query: {
      ...(f.building_id ? { building_id: f.building_id } : {}),
      ...(f.status ? { status: f.status } : {}),
      ...(f.floor ? { floor: f.floor } : {}),
      ...(f.search ? { search: f.search } : {}),
    },
  });
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(price);
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h1 class="text-2xl font-bold text-[--color-title]">{{ t("navigation.sidebar.rooms") }}</h1>
      <UButton color="primary" :to="`/app/rooms/new`">
        <IconPlus class="size-4" />
        {{ t("actions.create") }}
      </UButton>
    </div>

    <!-- Stats row -->
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <UCard class="p-3 text-center">
        <p class="text-2xl font-bold text-[--color-title]">{{ stats.total }}</p>
        <p class="text-xs text-[--color-body]">{{ t("rooms.stats.total") }}</p>
      </UCard>
      <UCard class="p-3 text-center">
        <p class="text-2xl font-bold text-green-600">{{ stats.available }}</p>
        <p class="text-xs text-[--color-body]">{{ t("rooms.stats.available") }}</p>
      </UCard>
      <UCard class="p-3 text-center">
        <p class="text-2xl font-bold text-blue-600">{{ stats.occupied }}</p>
        <p class="text-xs text-[--color-body]">{{ t("rooms.stats.occupied") }}</p>
      </UCard>
      <UCard class="p-3 text-center">
        <p class="text-2xl font-bold text-orange-500">{{ stats.maintenance }}</p>
        <p class="text-xs text-[--color-body]">{{ t("rooms.stats.maintenance") }}</p>
      </UCard>
      <UCard class="p-3 text-center">
        <p class="text-2xl font-bold text-purple-600">{{ stats.reserved }}</p>
        <p class="text-xs text-[--color-body]">{{ t("rooms.stats.reserved") }}</p>
      </UCard>
      <UCard class="p-3 text-center">
        <p class="text-2xl font-bold text-[--color-title]">{{ stats.occupancyRate }}%</p>
        <p class="text-xs text-[--color-body]">{{ t("rooms.stats.occupancy_rate") }}</p>
      </UCard>
    </div>

    <!-- Filters -->
    <RoomFilters
      :buildings="(buildings as Building[])"
      :initial="{ building_id: filters.building_id, status: filters.status, floor: filters.floor, search: filters.search }"
      @change="onFiltersChange"
    />

    <!-- Grid -->
    <RoomGrid
      :rooms="filteredRooms"
      :loading="loading"
      @click="openQuickView"
      @edit="(r: Room) => navigateTo(`/app/rooms/${r.id}/edit`)"
      @delete="openDelete"
    />

    <!-- Quick view modal -->
    <UModal v-model:open="showQuickView">
      <template #header>
        <h3 class="text-lg font-semibold text-[--color-title]">
          {{ t("rooms.detail.title") }} — {{ selectedRoom?.room_number }}
        </h3>
      </template>
      <div class="p-1">
        <div v-if="quickViewLoading" class="space-y-3">
          <USkeleton v-for="n in 4" :key="n" class="h-5 rounded" />
        </div>
        <div v-else-if="quickViewRoom" class="space-y-4">
          <div class="flex items-center gap-2">
            <RoomStatusBadge :status="quickViewRoom.status" />
            <span v-if="quickViewRoom.building" class="text-sm text-[--color-body]">
              {{ quickViewRoom.building.name }}
            </span>
          </div>
          <dl class="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt class="text-xs uppercase tracking-wide text-[--color-body]">{{ t("rooms.detail.floor") }}</dt>
              <dd class="mt-0.5 text-[--color-title]">{{ quickViewRoom.floor ?? "—" }}</dd>
            </div>
            <div>
              <dt class="text-xs uppercase tracking-wide text-[--color-body]">{{ t("rooms.detail.area") }}</dt>
              <dd class="mt-0.5 text-[--color-title]">{{ quickViewRoom.area ? `${quickViewRoom.area} m²` : "—" }}</dd>
            </div>
            <div>
              <dt class="text-xs uppercase tracking-wide text-[--color-body]">{{ t("rooms.detail.base_price") }}</dt>
              <dd class="mt-0.5 font-medium text-[--color-title]">{{ formatPrice(quickViewRoom.base_price) }}</dd>
            </div>
            <div>
              <dt class="text-xs uppercase tracking-wide text-[--color-body]">{{ t("rooms.detail.deposit_amount") }}</dt>
              <dd class="mt-0.5 text-[--color-title]">{{ formatPrice(quickViewRoom.deposit_amount) }}</dd>
            </div>
            <div v-if="quickViewRoom.current_tenant" class="col-span-2">
              <dt class="text-xs uppercase tracking-wide text-[--color-body]">{{ t("rooms.detail.current_tenant") }}</dt>
              <dd class="mt-0.5 text-[--color-title]">{{ quickViewRoom.current_tenant.full_name ?? "—" }}</dd>
            </div>
          </dl>
          <div v-if="quickViewRoom.description" class="text-sm text-[--color-body]">
            {{ quickViewRoom.description }}
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <UButton
              variant="outline"
              color="neutral"
              :to="`/app/rooms/${quickViewRoom.id}`"
              @click="showQuickView = false"
            >
              {{ t("actions.view") }}
            </UButton>
            <UButton
              color="primary"
              :to="`/app/rooms/${quickViewRoom.id}/edit`"
              @click="showQuickView = false"
            >
              {{ t("actions.edit") }}
            </UButton>
          </div>
        </div>
      </div>
    </UModal>

    <!-- Delete confirm modal -->
    <UModal v-model:open="showDeleteModal">
      <template #header>
        <h3 class="text-lg font-semibold text-[--color-title]">{{ t("actions.delete") }}</h3>
      </template>
      <div class="space-y-4 p-1">
        <p class="text-sm text-[--color-body]">{{ t("rooms.delete_confirm") }}</p>
        <div class="flex justify-end gap-3">
          <UButton color="neutral" variant="ghost" @click="showDeleteModal = false">
            {{ t("actions.cancel") }}
          </UButton>
          <UButton color="error" :loading="deleting" @click="confirmDelete">
            {{ t("actions.delete") }}
          </UButton>
        </div>
      </div>
    </UModal>
  </div>
</template>
