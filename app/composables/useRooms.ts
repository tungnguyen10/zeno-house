import type { Room, CreateRoomInput, UpdateRoomInput, RoomStatus } from "~/types/rooms";

export interface RoomFilters {
  building_id: string;
  status: string;
  floor: string;
  search: string;
}

export interface RoomStats {
  total: number;
  available: number;
  occupied: number;
  maintenance: number;
  reserved: number;
  occupancyRate: number;
}

export function useRooms() {
  const rooms = ref<Room[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const filters = reactive<RoomFilters>({
    building_id: "",
    status: "",
    floor: "",
    search: "",
  });

  const filteredRooms = computed(() => {
    let list = rooms.value;
    if (filters.building_id) list = list.filter((r) => r.building_id === filters.building_id);
    if (filters.status) list = list.filter((r) => r.status === filters.status);
    if (filters.floor !== "") {
      const f = Number(filters.floor);
      if (!isNaN(f)) list = list.filter((r) => r.floor === f);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (r) =>
          r.room_number.toLowerCase().includes(q) ||
          (r.building?.name ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  });

  const stats = computed<RoomStats>(() => {
    const list = filteredRooms.value;
    const total = list.length;
    const counts = {
      available: list.filter((r) => r.status === "available").length,
      occupied: list.filter((r) => r.status === "occupied").length,
      maintenance: list.filter((r) => r.status === "maintenance").length,
      reserved: list.filter((r) => r.status === "reserved").length,
    };
    return {
      total,
      ...counts,
      occupancyRate: total === 0 ? 0 : Math.round((counts.occupied / total) * 100),
    };
  });

  async function fetchRooms(fetchFilters?: Partial<RoomFilters>) {
    loading.value = true;
    error.value = null;
    try {
      const params = new URLSearchParams();
      const active = fetchFilters ?? filters;
      if (active.building_id) params.set("building_id", active.building_id);
      if (active.status) params.set("status", active.status);
      if (active.floor) params.set("floor", active.floor);
      const qs = params.toString();
      rooms.value = await $fetch<Room[]>(`/api/rooms${qs ? `?${qs}` : ""}`);
    } catch {
      error.value = "rooms.error";
    } finally {
      loading.value = false;
    }
  }

  async function getRoom(id: string): Promise<Room | null> {
    try {
      return await $fetch<Room>(`/api/rooms/${id}`);
    } catch {
      return null;
    }
  }

  async function createRoom(input: CreateRoomInput): Promise<Room> {
    return await $fetch<Room>("/api/rooms", { method: "POST", body: input });
  }

  async function updateRoom(id: string, input: UpdateRoomInput): Promise<Room> {
    return await $fetch<Room>(`/api/rooms/${id}`, { method: "PUT", body: input });
  }

  async function deleteRoom(id: string): Promise<void> {
    await $fetch(`/api/rooms/${id}`, { method: "DELETE" });
  }

  async function updateStatus(id: string, status: RoomStatus): Promise<Room> {
    return updateRoom(id, { status });
  }

  return {
    rooms,
    loading,
    error,
    filters,
    filteredRooms,
    stats,
    fetchRooms,
    getRoom,
    createRoom,
    updateRoom,
    deleteRoom,
    updateStatus,
  };
}
