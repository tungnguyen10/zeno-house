import type { Building, CreateBuildingInput, UpdateBuildingInput } from "~/types/buildings";

export function useBuildings() {
  const buildings = ref<Building[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const search = ref("");

  const filteredBuildings = computed(() => {
    const q = search.value.trim().toLowerCase();
    if (!q) return buildings.value;
    return buildings.value.filter(
      (b) => b.name.toLowerCase().includes(q) || b.address.toLowerCase().includes(q),
    );
  });

  async function fetchBuildings() {
    loading.value = true;
    error.value = null;
    try {
      buildings.value = await $fetch<Building[]>("/api/buildings");
    } catch {
      error.value = "buildings.error";
    } finally {
      loading.value = false;
    }
  }

  async function getBuilding(id: string): Promise<Building | null> {
    try {
      return await $fetch<Building>(`/api/buildings/${id}`);
    } catch {
      return null;
    }
  }

  async function createBuilding(input: CreateBuildingInput): Promise<Building> {
    return await $fetch<Building>("/api/buildings", { method: "POST", body: input });
  }

  async function updateBuilding(id: string, input: UpdateBuildingInput): Promise<Building> {
    return await $fetch<Building>(`/api/buildings/${id}`, { method: "PUT", body: input });
  }

  async function deleteBuilding(id: string): Promise<void> {
    await $fetch(`/api/buildings/${id}`, { method: "DELETE" });
  }

  return {
    buildings,
    loading,
    error,
    search,
    filteredBuildings,
    fetchBuildings,
    getBuilding,
    createBuilding,
    updateBuilding,
    deleteBuilding,
  };
}
