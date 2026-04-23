import { useAuthStore } from "~/stores/auth";

export default defineNuxtRouteMiddleware(async () => {
  if (import.meta.server) return;

  const user = useSupabaseUser();
  if (!user.value) return;

  const authStore = useAuthStore();
  const role = await authStore.fetchRole();

  if (role === "admin") return navigateTo("/admin");
  if (role === "manager") return navigateTo("/manager");
  if (role === "tenant") return navigateTo("/tenant");
});
