export default defineNuxtRouteMiddleware(async () => {
  const user = useSupabaseUser();
  if (!user.value) {
    return navigateTo("/login");
  }

  const authStore = useAuthStore();
  const role = await authStore.fetchRole();

  if (role !== "admin" && role !== "manager") {
    return navigateTo("/login");
  }

  const permissionsStore = usePermissionsStore();
  if (!permissionsStore.loaded) {
    await permissionsStore.loadPermissions();
  }
});
