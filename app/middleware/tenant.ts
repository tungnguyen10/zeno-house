import { useAuthStore } from "~/stores/auth";

// Use with 'auth' middleware: definePageMeta({ middleware: ['auth', 'tenant'] })
export default defineNuxtRouteMiddleware(async () => {
  const authStore = useAuthStore();
  const role = await authStore.fetchRole();
  if (role !== "tenant") return navigateTo("/login");
});
