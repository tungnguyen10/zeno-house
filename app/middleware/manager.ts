import { useAuthStore } from "~/stores/auth";

// Use with 'auth' middleware: definePageMeta({ middleware: ['auth', 'manager'] })
export default defineNuxtRouteMiddleware(async () => {
  const authStore = useAuthStore();
  const role = await authStore.fetchRole();
  if (role !== "admin" && role !== "manager") return navigateTo("/login");
});
