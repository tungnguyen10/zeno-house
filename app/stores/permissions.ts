interface BuildingGrant {
  building_id: string;
  building_name: string;
  permissions: string[];
}

type PermissionsResponse = { isAdmin: true } | BuildingGrant[];

export const usePermissionsStore = defineStore("permissions", () => {
  const isAdmin = ref(false);
  const grants = ref<BuildingGrant[]>([]);
  const loaded = ref(false);

  async function loadPermissions() {
    if (loaded.value) return;
    const data = await $fetch<PermissionsResponse>("/api/me/permissions").catch(() => null);
    if (!data) return;
    if (!Array.isArray(data) && data.isAdmin) {
      isAdmin.value = true;
      grants.value = [];
    } else if (Array.isArray(data)) {
      isAdmin.value = false;
      grants.value = data;
    }
    loaded.value = true;
  }

  function hasPermission(buildingId: string, feature: string): boolean {
    if (isAdmin.value) return true;
    const grant = grants.value.find((g) => g.building_id === buildingId);
    return grant?.permissions.includes(feature) ?? false;
  }

  function hasAnyPermission(feature: string): boolean {
    if (isAdmin.value) return true;
    return grants.value.some((g) => g.permissions.includes(feature));
  }

  function $reset() {
    isAdmin.value = false;
    grants.value = [];
    loaded.value = false;
  }

  return { isAdmin, grants, loaded, loadPermissions, hasPermission, hasAnyPermission, $reset };
});
