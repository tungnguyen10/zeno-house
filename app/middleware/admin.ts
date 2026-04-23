import { useAuthStore } from "~/stores/auth";

// Use with 'auth' middleware: definePageMeta({ middleware: ['auth', 'admin'] })
export default defineNuxtRouteMiddleware(async () => {
  const authStore = useAuthStore();
  const role = await authStore.fetchRole();
  if (role !== "admin") return navigateTo("/login");
});
