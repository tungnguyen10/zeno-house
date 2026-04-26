import { useAuthStore } from "~/stores/auth";
import type { Role } from "~/types";

const ROLE_HIERARCHY: Record<Role, number> = { admin: 3, manager: 2, tenant: 1 };

export function useAuth() {
  const supabase = useSupabaseClient();
  const authStore = useAuthStore();
  const { t } = useI18n();

  const isAdmin = computed(() => authStore.role === "admin");
  const isManager = computed(() => authStore.role === "manager");
  const isTenant = computed(() => authStore.role === "tenant");

  async function login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(t("auth.errors.invalid_credentials"));
    // Fetch profile via Supabase client directly — avoids cookie timing issue
    // where $fetch('/api/auth/me') fires before the session cookie is set
    const { data: profileData } = await supabase
      .from("profiles")
      .select("role, full_name, created_at")
      .eq("id", data.user.id)
      .maybeSingle<{ role: string; full_name: string | null; created_at: string }>();
    if (profileData?.role) {
      authStore.setProfile({
        id: data.user.id,
        email: data.user.email ?? "",
        role: profileData.role as Role,
        full_name: profileData.full_name,
        created_at: profileData.created_at,
      });
    } else {
      await supabase.auth.signOut();
      throw new Error(t("auth.errors.invalid_credentials"));
    }
  }

  async function loginWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${useRequestURL().origin}/auth/callback`,
      },
    });
    if (error) throw new Error(error.message);
  }

  async function signOut() {
    await supabase.auth.signOut();
    authStore.$reset();
  }

  async function logout() {
    await signOut();
    await navigateTo("/login");
  }

  async function forgotPassword(email: string) {
    const redirectTo = `${useRequestURL().origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw new Error(error.message);
  }

  async function resetPassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(error.message);
    await signOut();
  }

  async function fetchProfile() {
    await authStore.fetchProfile();
  }

  function hasPermission(requiredRole: Role): boolean {
    const current = authStore.role;
    if (!current) return false;
    return ROLE_HIERARCHY[current as Role] >= ROLE_HIERARCHY[requiredRole];
  }

  return { login, loginWithGoogle, signOut, logout, forgotPassword, resetPassword, fetchProfile, isAdmin, isManager, isTenant, hasPermission };
}
